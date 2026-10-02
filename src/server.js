import http from 'node:http';
import { loadEnvFile } from './load-env.js';
import { loadConfig } from './config.js';
import { createGankClient, getProfileNickname } from './gank-client.js';
import { createStateStore, stateFileForCreator } from './state-store.js';
import { createNotifier } from './notifier.js';
import { createChecker } from './checker.js';

loadEnvFile();
const config = loadConfig();
const nicknames = [...new Set(config.profiles.map(getProfileNickname))];
const client = createGankClient({ timeoutMs: config.requestTimeoutMs });
const notifier = createNotifier({
  webhookUrl: config.webhookUrl,
  webhookType: config.webhookType,
  telegramBotToken: config.telegramBotToken,
  telegramChatId: config.telegramChatId,
  timeoutMs: config.requestTimeoutMs,
});
const checkers = new Map(nicknames.map((nickname) => [
  nickname.toLowerCase(),
  createChecker({
    nickname,
    postsPerPage: config.postsPerPage,
    notifyOnFirstRun: config.notifyOnFirstRun,
    client,
    store: createStateStore(stateFileForCreator(config.stateDir, nickname)),
    notifier,
  }),
]));

function statuses() {
  return [...checkers.values()].map((checker) => checker.getStatus());
}

async function checkAll() {
  const entries = [...checkers.entries()];
  const results = await Promise.allSettled(entries.map(([, checker]) => checker.check()));
  return results.map((result, index) => ({
    nickname: entries[index][0],
    ok: result.status === 'fulfilled',
    status: result.status === 'fulfilled' ? result.value : entries[index][1].getStatus(),
    ...(result.status === 'rejected' ? { error: result.reason.message } : {}),
  }));
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
  response.end(`${JSON.stringify(body, null, 2)}\n`);
}

function isLoopback(address) {
  return address === '127.0.0.1'
    || address === '::1'
    || address === '::ffff:127.0.0.1';
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');

  if (request.method === 'GET' && url.pathname === '/health') {
    const profileStatuses = statuses();
    const ok = profileStatuses.every((status) => !status.lastError);
    return sendJson(response, ok ? 200 : 503, {
      ok,
      service: 'gank-post-notify',
      profiles: profileStatuses,
    });
  }

  if (request.method === 'GET' && url.pathname === '/api/status') {
    return sendJson(response, 200, {
      intervalMs: config.intervalMs,
      profiles: statuses(),
    });
  }

  if (request.method === 'GET' && url.pathname.startsWith('/api/status/')) {
    const nickname = decodeURIComponent(url.pathname.slice('/api/status/'.length)).toLowerCase();
    const checker = checkers.get(nickname);
    return checker
      ? sendJson(response, 200, checker.getStatus())
      : sendJson(response, 404, { error: 'Creator is not configured' });
  }

  if (request.method === 'POST' && url.pathname === '/api/check') {
    const results = await checkAll();
    const ok = results.every((result) => result.ok);
    return sendJson(response, ok ? 200 : 502, { ok, profiles: results });
  }

  if (request.method === 'POST' && url.pathname === '/api/shutdown') {
    if (!isLoopback(request.socket.remoteAddress)) {
      return sendJson(response, 403, { error: 'Shutdown is only available locally' });
    }
    sendJson(response, 202, { ok: true, message: 'Service is shutting down' });
    setImmediate(() => shutdown('Local shutdown request'));
    return;
  }

  return sendJson(response, 404, { error: 'Not found' });
});

server.listen(config.port, () => {
  console.info(`Gank post checker listening on http://localhost:${config.port}`);
  console.info(`Watching ${nicknames.join(', ')} every ${config.intervalMs} ms`);
  if (!config.webhookUrl && !config.telegramBotToken) {
    console.info('No notification destination is configured');
  }
});

checkAll().catch(() => {});
const timer = setInterval(() => checkAll().catch(() => {}), config.intervalMs);
timer.unref();

function shutdown(signal) {
  console.info(`${signal} received, shutting down`);
  clearInterval(timer);
  server.close(() => process.exit(0));
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
