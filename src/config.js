import { fileURLToPath } from 'node:url';

// Application settings are constants. Only Telegram credentials come from env.
export const CONFIG = Object.freeze({
  profiles: Object.freeze([
    'baemonfan', 'k9kingdata', 'yoichi69', 'sakuradata', 'loveshakedata',
    'keqingdata', 'kdatastudio', 'idolxdata', 'idollove', 'datacoffeeshop',
  ]),
  intervalMs: 60_000,
  port: 3000,
  webhookUrl: '',
  webhookType: 'generic',
  notifyOnFirstRun: false,
  stateDir: fileURLToPath(new URL('../data/', import.meta.url)),
  postsPerPage: 20,
  requestTimeoutMs: 15_000,
});

export function loadConfig() {
  const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN || '';
  const telegramChatId = process.env.TELEGRAM_CHAT_ID || '';
  if (Boolean(telegramBotToken) !== Boolean(telegramChatId)) {
    throw new Error('TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be set together');
  }
  return { ...CONFIG, telegramBotToken, telegramChatId };
}
