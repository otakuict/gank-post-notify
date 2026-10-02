import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { loadEnvFile } from '../src/load-env.js';

test('loadEnvFile reads values and does not overwrite existing environment variables', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'gank-env-'));
  const filename = path.join(directory, '.env');
  const originalA = process.env.TELEGRAM_BOT_TOKEN;
  const originalB = process.env.TELEGRAM_CHAT_ID;
  const originalPort = process.env.PORT;

  try {
    await writeFile(filename, 'TELEGRAM_BOT_TOKEN="hello world"\nTELEGRAM_CHAT_ID=file-value # comment\nPORT=9999\n');
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.PORT;
    process.env.TELEGRAM_CHAT_ID = 'already-set';
    loadEnvFile(filename);
    assert.equal(process.env.TELEGRAM_BOT_TOKEN, 'hello world');
    assert.equal(process.env.TELEGRAM_CHAT_ID, 'already-set');
    assert.equal(process.env.PORT, undefined);
  } finally {
    if (originalA === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
    else process.env.TELEGRAM_BOT_TOKEN = originalA;
    if (originalB === undefined) delete process.env.TELEGRAM_CHAT_ID;
    else process.env.TELEGRAM_CHAT_ID = originalB;
    if (originalPort === undefined) delete process.env.PORT;
    else process.env.PORT = originalPort;
    await rm(directory, { recursive: true, force: true });
  }
});
