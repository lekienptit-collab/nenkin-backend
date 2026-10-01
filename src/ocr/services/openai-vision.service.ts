import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IncomingHttpHeaders } from 'http';
import { request as httpsRequest } from 'https';
import { URL } from 'url';
import { ErrorCode } from 'src/common/constatns/error';
import { CBadRequestException } from 'src/common/exceptions/bad-request.exception';

/** Lỗi bị giới hạn tốc độ, kèm số mili giây OpenAI đề nghị chờ. */
export class OpenAIRateLimitError extends Error {
  constructor(public readonly retryAfterMs: number, message: string) {
    super(message);
  }
}

interface OpenAIResponse {
  choices?: { message?: { content?: string } }[];
  usage?: { prompt_tokens?: number; total_tokens?: number };
  error?: { message?: string; type?: string; code?: string };
}

/**
 * Thời gian chờ trước khi thử lại sau 429. OpenAI gửi kèm header
 * `retry-after-ms` / `retry-after`, và lời nhắn dạng "Please try again in 1.2s"
 * hoặc "in 120ms" - ưu tiên header, thiếu thì đọc lời nhắn.
 */
export const parseRetryAfter = (
  headers: IncomingHttpHeaders,
  message: string,
): number => {
  const ms = Number(headers['retry-after-ms']);
  if (Number.isFinite(ms) && ms > 0) {
    return Math.ceil(ms) + 500;
  }
  const seconds = Number(headers['retry-after']);
  if (Number.isFinite(seconds) && seconds > 0) {
    return Math.ceil(seconds * 1000) + 500;
  }
  const match = /try again in ([\d.]+)\s*(ms|s)\b/i.exec(message || '');
  if (match) {
    const value = parseFloat(match[1]);
    const wait = match[2].toLowerCase() === 'ms' ? value : value * 1000;
    return Math.ceil(wait) + 500;
  }
  return 10000;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Gọi OpenAI chat completions với 1 ảnh và bắt model trả về JSON.
 *
 * Dùng `https` của Node thay vì thêm thư viện SDK, vì chỉ cần đúng một API.
 */
@Injectable()
export class OpenAIVisionService {
  private readonly logger = new Logger(OpenAIVisionService.name);

  constructor(private readonly config: ConfigService) {}

  get isConfigured(): boolean {
    return !!this.config.get<string>('openai.apiKey');
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
      model: this.config.get<string>('openai.model'),
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
                // Giấy tờ có nhiều chữ nhỏ, đọc ở độ phân giải thấp dễ sai.
                detail: 'high',
              },
            },
          ],
        },
      ],
      temperature: 0,
      // Các model mới của OpenAI không nhận `max_tokens` nữa.
      max_completion_tokens: 2048,
      response_format: { type: 'json_object' },
    };

    const maxRetries = this.config.get<number>('openai.maxRetries');
    for (let attempt = 0; ; attempt += 1) {
      try {
        const body = await this.post('/chat/completions', payload);
        return this.parseContent(body);
      } catch (error) {
        const isRetryable =
          error instanceof OpenAIRateLimitError && attempt < maxRetries;
        if (!isRetryable) {
          throw error;
        }
        this.logger.warn(
          `OpenAI giới hạn tốc độ, chờ ${
            error.retryAfterMs
          }ms rồi thử lại (lần ${attempt + 1}/${maxRetries})`,
        );
        await sleep(error.retryAfterMs);
      }
    }
  }

  private parseContent(body: OpenAIResponse): Record<string, any> {
    const content = body.choices?.[0]?.message?.content;
    if (!content) {
      throw new CBadRequestException(ErrorCode.OCR_EMPTY_RESULT);
    }
    try {
      const parsed = JSON.parse(content);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
      this.logger.warn(
        `OpenAI trả về JSON không hợp lệ: ${content.slice(0, 200)}`,
      );
      throw new CBadRequestException(ErrorCode.OCR_EMPTY_RESULT);
    }
  }

  private post(path: string, payload: unknown): Promise<OpenAIResponse> {
    const url = new URL(`${this.config.get<string>('openai.baseUrl')}${path}`);
    const data = Buffer.from(JSON.stringify(payload));

    return new Promise((resolve, reject) => {
      const req = httpsRequest(
        {
          hostname: url.hostname,
          port: url.port || undefined,
          path: url.pathname + url.search,
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.config.get<string>('openai.apiKey')}`,
            'Content-Type': 'application/json',
            'Content-Length': data.length,
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
            let parsed: OpenAIResponse = {};
            try {
              parsed = JSON.parse(raw);
            } catch {
              // Lỗi hạ tầng (proxy, gateway) có thể trả HTML chứ không phải JSON.
            }

            // Hết tiền / hết hạn mức của tài khoản cũng trả 429, nhưng chờ
            // bao lâu cũng không hết - phải báo riêng để không tưởng là lỗi code.
            const isQuotaExceeded =
              parsed.error?.code === 'insufficient_quota' ||
              parsed.error?.type === 'insufficient_quota';
            if (res.statusCode === 429 && isQuotaExceeded) {
              this.logger.error(
                `OpenAI báo hết hạn mức tài khoản: ${parsed.error?.message}`,
              );
              reject(
                new CBadRequestException(ErrorCode.OCR_QUOTA_EXCEEDED, {
                  status: res.statusCode,
                  message: parsed.error?.message,
                }),
              );
              return;
            }
            if (res.statusCode === 429) {
              const message = parsed.error?.message || raw;
              reject(
                new OpenAIRateLimitError(
                  parseRetryAfter(res.headers, message),
                  message,
                ),
              );
              return;
            }
            if (res.statusCode !== 200) {
              this.logger.error(
                `OpenAI HTTP ${res.statusCode}: ${raw.slice(0, 300)}`,
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

      req.setTimeout(this.config.get<number>('openai.timeout'), () =>
        req.destroy(new Error('OpenAI request timeout')),
      );
      req.on('error', (error) => {
        this.logger.error(`Không gọi được OpenAI: ${error.message}`);
        reject(new CBadRequestException(ErrorCode.OCR_PROVIDER_ERROR));
      });
      req.write(data);
      req.end();
    });
  }
}
