import { registerAs } from '@nestjs/config';

export default registerAs('openai', () => ({
  apiKey: process.env.OPENAI_API_KEY || '',
  baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  /** Model phải nhận được ảnh và chấp nhận `temperature`. */
  model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
  timeout: parseInt(process.env.OPENAI_TIMEOUT || '60000', 10),
  /** Số lần thử lại khi bị giới hạn tốc độ (HTTP 429). */
  maxRetries: parseInt(process.env.OPENAI_MAX_RETRIES || '2', 10),
}));
