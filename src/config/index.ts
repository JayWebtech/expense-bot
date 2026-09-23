import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z
    .string()
    .default('3000')
    .transform((v) => parseInt(v, 10)),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  TELEGRAM_BOT_TOKEN: z.string().min(1, 'TELEGRAM_BOT_TOKEN is required'),
  TELEGRAM_WEBHOOK_SECRET: z.string().optional(),
  TELEGRAM_MODE: z.enum(['polling', 'webhook']).default('polling'),

  DEEPSEEK_API_KEY: z.string().optional(),
  DEEPSEEK_BASE_URL: z.string().default('https://api.deepseek.com/v1'),
  AI_MODEL: z.string().default('deepseek-chat'),

  STT_PROVIDER: z.enum(['deepgram', 'mock']).default('mock'),
  DEEPGRAM_API_KEY: z.string().optional(),

  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  CLOUDINARY_FOLDER: z.string().default('expense-bot'),

  APP_URL: z.string().optional(),

  DEFAULT_CURRENCY: z.string().default('NGN'),
  DEFAULT_TIMEZONE: z.string().default('Africa/Lagos'),

  ENCRYPTION_KEY: z.string().optional(),

  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),
});

export type Config = z.infer<typeof envSchema>;

function loadConfig(): Config {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    process.stderr.write('❌ Invalid environment configuration:\n');
    process.stderr.write(JSON.stringify(result.error.flatten().fieldErrors, null, 2) + '\n');
    process.exit(1);
  }
  return result.data;
}

export const config = loadConfig();
export default config;
