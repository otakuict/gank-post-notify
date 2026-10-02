import test from 'node:test';
import assert from 'node:assert/strict';
import { createNotifier } from '../src/notifier.js';

test('Telegram alert sends chat id, post title, and post URL', async () => {
  const requests = [];
  const notifier = createNotifier({
    telegramBotToken: 'test-token',
    telegramChatId: '-100123456',
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return { ok: true, status: 200 };
    },
  });

  const result = await notifier.notify({
    creator: { id: 'creator-1', nickname: 'baemonfan' },
    posts: [{
      id: 'post-1',
      title: 'A new post',
      createdAt: '2026-09-16T00:00:00Z',
    }],
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'https://api.telegram.org/bottest-token/sendMessage');
  const body = JSON.parse(requests[0].options.body);
  assert.equal(body.chat_id, '-100123456');
  assert.match(body.text, /A new post/);
  assert.match(body.text, /2026-09-16 07:00:00 \(UTC\+7\)/);
  assert.match(body.text, /https:\/\/ganknow\.com\/post\/post-1/);
  assert.deepEqual(result.targets, ['telegram']);
});

test('notifier can send webhook and Telegram alerts together', async () => {
  const urls = [];
  const notifier = createNotifier({
    webhookUrl: 'https://hooks.example.test/gank',
    webhookType: 'generic',
    telegramBotToken: 'test-token',
    telegramChatId: '123',
    fetchImpl: async (url) => {
      urls.push(url);
      return { ok: true, status: 200 };
    },
  });

  const result = await notifier.notify({
    creator: { id: 'creator-1', nickname: 'baemonfan' },
    posts: [{ id: 'post-1', title: 'New', createdAt: '2026-09-16T00:00:00Z' }],
  });

  assert.equal(urls.length, 2);
  assert.deepEqual(result.targets, ['webhook', 'telegram']);
});
