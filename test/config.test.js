import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, loadConfig } from '../src/config.js';

test('only Telegram credentials can override application configuration', () => {
  const values = {
    PORT: '9999', GANK_PROFILES: 'unexpected', STATE_DIR: '/unexpected',
    CHECK_INTERVAL_MS: '1', WEBHOOK_URL: 'https://unexpected.invalid',
    WEBHOOK_TYPE: 'invalid', NOTIFY_ON_FIRST_RUN: 'true',
    POSTS_PER_PAGE: '1', REQUEST_TIMEOUT_MS: '1',
    TELEGRAM_BOT_TOKEN: 'test-token', TELEGRAM_CHAT_ID: '-123',
  };
  const original = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  try {
    Object.assign(process.env, values);
    assert.deepEqual(loadConfig(), {
      ...CONFIG, telegramBotToken: 'test-token', telegramChatId: '-123',
    });
    delete process.env.TELEGRAM_CHAT_ID;
    assert.throws(() => loadConfig(), /must be set together/);
    delete process.env.TELEGRAM_BOT_TOKEN;
    process.env.TELEGRAM_CHAT_ID = '-123';
    assert.throws(() => loadConfig(), /must be set together/);
    delete process.env.TELEGRAM_CHAT_ID;
    assert.equal(loadConfig().telegramBotToken, '');
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
