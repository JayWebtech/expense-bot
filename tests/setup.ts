import { beforeAll, afterAll } from 'vitest';

// Set test environment variables before importing config
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/expense_bot_test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.TELEGRAM_BOT_TOKEN = 'test_bot_token_123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghi';
process.env.LOG_LEVEL = 'silent';

beforeAll(() => {
  // Global test setup
});

afterAll(() => {
  // Global test cleanup
});
