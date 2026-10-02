import { readFileSync } from 'node:fs';

function parseValue(raw) {
  const value = raw.trim();
  if (value.length >= 2) {
    const quote = value[0];
    if ((quote === '"' || quote === "'") && value.at(-1) === quote) {
      const unquoted = value.slice(1, -1);
      return quote === '"'
        ? unquoted.replace(/\\n/g, '\n').replace(/\\r/g, '\r')
        : unquoted;
    }
  }
  return value.replace(/\s+#.*$/, '').trim();
}

export function loadEnvFile(filename = '.env') {
  let contents;
  try {
    contents = readFileSync(filename, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }

  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (!['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'].includes(key)) continue;
    if (process.env[key] === undefined) process.env[key] = parseValue(rawValue);
  }
}
