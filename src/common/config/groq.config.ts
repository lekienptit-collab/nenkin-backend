import { registerAs } from '@nestjs/config';

export default registerAs('groq', () => ({
  apiKey: process.env.GROQ_API_KEY || '',
  baseUrl: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
  /** Model phải nhận được ảnh (input_modalities có "image"). */
  model: process.env.GROQ_MODEL || 'qwen/qwen3.8-27b',
  timeout: parseInt(process.env.GROQ_TIMEOUT || '60000', 10),
  /** Số lần thử lại khi bị giới hạn tốc độ (HTTP 429). */
  maxRetries: parseInt(process.env.GROQ_MAX_RETRIES || '2', 10),
}));
