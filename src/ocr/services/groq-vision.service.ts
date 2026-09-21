import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { request as httpsRequest } from 'https';
import { URL } from 'url';
import { ErrorCode } from 'src/common/constatns/error';
import { CBadRequestException } from 'src/common/exceptions/bad-request.exception';

/** Lỗi bị giới hạn tốc độ, kèm số giây Groq đề nghị chờ. */
export class GroqRateLimitError extends Error {
  constructor(public readonly retryAfterMs: number, message: string) {
    super(message);
  }
}

interface GroqResponse {
  choices?: { message?: { content?: string } }[];
  usage?: { prompt_tokens?: number; total_tokens?: number };
  error?: { message?: string; code?: string };
}

/** Groq gợi ý thời gian chờ trong lời nhắn: "Please try again in 17.95s". */
const parseRetryAfter = (message: string): number => {
  const match = /try again in ([\d.]+)s/i.exec(message || '');
  const seconds = match ? parseFloat(match[1]) : NaN;
  return Number.isFinite(seconds) ? Math.ceil(seconds * 1000) + 500 : 20000;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Gọi Groq chat completions với 1 ảnh và bắt model trả về JSON.
 *
 * Dùng `https` của Node thay vì thêm thư viện HTTP mới, và đặt User-Agent
 * tường minh vì Cloudflare của Groq chặn request không có User-Agent.
 */
@Injectable()
export class GroqVisionService {
  private readonly logger = new Logger(GroqVisionService.name);

  constructor(private readonly config: ConfigService) {}

  get isConfigured(): boolean {
    return !!this.config.get<string>('groq.apiKey');
  }

  /** Đọc ảnh theo yêu cầu `prompt`, trả về object JSON do model sinh ra. */
  async extractJson(
    prompt: string,
    image: { buffer: Buffer; mimeType: string },
  ): Promise<Record<string, any>> {
    if (!this.isConfigured) {
      throw new CBadRequestException(ErrorCode.OCR_NOT_CONFIGURED);
    }

    const payload = {
      model: this.config.get<string>('groq.model'),
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:${image.mimeType};base64,${image.buffer.toString(
                  'base64',
                )}`,
              },
            },
          ],
        },
      ],
      temperature: 0,
      max_tokens: 2048,
      response_format: { type: 'json_object' },
    };

    const maxRetries = this.config.get<number>('groq.maxRetries');
    for (let attempt = 0; ; attempt += 1) {
      try {
        const body = await this.post('/chat/completions', payload);
        return this.parseContent(body);
      } catch (error) {
        const isRetryable =
          error instanceof GroqRateLimitError && attempt < maxRetries;
        if (!isRetryable) {
          throw error;
        }
        this.logger.warn(
          `Groq giới hạn tốc độ, chờ ${error.retryAfterMs}ms rồi thử lại (lần ${
            attempt + 1
          }/${maxRetries})`,
        );
        await sleep(error.retryAfterMs);
      }
    }
  }

  private parseContent(body: GroqResponse): Record<string, any> {
    const content = body.choices?.[0]?.message?.content;
    if (!content) {
      throw new CBadRequestException(ErrorCode.OCR_EMPTY_RESULT);
    }
    try {
      const parsed = JSON.parse(content);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
      this.logger.warn(
        `Groq trả về JSON không hợp lệ: ${content.slice(0, 200)}`,
      );
      throw new CBadRequestException(ErrorCode.OCR_EMPTY_RESULT);
    }
  }

  private post(path: string, payload: unknown): Promise<GroqResponse> {
    const url = new URL(`${this.config.get<string>('groq.baseUrl')}${path}`);
    const data = Buffer.from(JSON.stringify(payload));

    return new Promise((resolve, reject) => {
      const req = httpsRequest(
        {
          hostname: url.hostname,
          path: url.pathname + url.search,
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.config.get<string>('groq.apiKey')}`,
            'Content-Type': 'application/json',
            'Content-Length': data.length,
            // Cloudflare của Groq trả 403 nếu không có User-Agent.
            'User-Agent': 'nenkin-backend',
            Accept: 'application/json',
          },
        },
        (res) => {
          let raw = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => {
            raw += chunk;
          });
          res.on('end', () => {
            let parsed: GroqResponse = {};
            try {
              parsed = JSON.parse(raw);
            } catch {
              // Lỗi hạ tầng (Cloudflare) trả HTML chứ không phải JSON.
            }

            if (res.statusCode === 429) {
              const message = parsed.error?.message || raw;
              reject(new GroqRateLimitError(parseRetryAfter(message), message));
              return;
            }
            if (res.statusCode !== 200) {
              this.logger.error(
                `Groq HTTP ${res.statusCode}: ${raw.slice(0, 300)}`,
              );
              reject(
                new CBadRequestException(ErrorCode.OCR_PROVIDER_ERROR, {
                  status: res.statusCode,
                  message: parsed.error?.message,
                }),
              );
              return;
            }
            resolve(parsed);
          });
        },
      );

      req.setTimeout(this.config.get<number>('groq.timeout'), () =>
        req.destroy(new Error('Groq request timeout')),
      );
      req.on('error', (error) => {
        this.logger.error(`Không gọi được Groq: ${error.message}`);
        reject(new CBadRequestException(ErrorCode.OCR_PROVIDER_ERROR));
      });
      req.write(data);
      req.end();
    });
  }
}
