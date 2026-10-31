import { formatUtc7 } from './time.js';
import { listingUrl } from './urls.js';
import { request as httpsRequest } from 'node:https';

function postUrl(post) {
  return `https://ganknow.com/post/${post.id}`;
}

function telegramText(creator, posts, listings) {
  const lines = [
    `🔔 ${creator.nickname}: โพสต์ใหม่ ${posts.length}, listing ใหม่ ${listings.length}`,
    '',
  ];

  const items = [
    ...posts.map((post) => ({ type: 'โพสต์', title: post.title, createdAt: post.createdAt, url: postUrl(post) })),
    ...listings.map((listing) => ({ type: 'listing', title: listing.name, createdAt: listing.createdAt, url: listingUrl(listing) })),
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  for (const [index, item] of items.slice(0, 10).entries()) {
    lines.push(`${index + 1}. [${item.type}] ${item.title || '(ไม่มีชื่อ)'}`);
    const localTime = formatUtc7(item.createdAt);
    if (localTime) lines.push(`เวลา: ${localTime}`);
    lines.push(item.url);
    if (index < Math.min(items.length, 10) - 1) lines.push('');
  }
  if (items.length > 10) lines.push('', `และอีก ${items.length - 10} รายการ`);

  // Telegram sendMessage accepts at most 4,096 characters.
  return lines.join('\n').slice(0, 4_096);
}

function postJsonIpv4(url, payload, timeoutMs) {
  return new Promise((resolve, reject) => {
    const request = httpsRequest(url, {
      method: 'POST',
      family: 4,
      headers: { 'content-type': 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
    }, (response) => {
      response.resume();
      response.on('end', () => resolve({
        ok: response.statusCode >= 200 && response.statusCode < 300,
        status: response.statusCode,
      }));
      response.on('error', reject);
    });
    request.on('error', reject);
    request.end(JSON.stringify(payload));
  });
}

async function postJson(url, payload, { fetchImpl, timeoutMs, targetName, ipv4 = false }) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let response;
    try {
      response = ipv4 && fetchImpl === fetch
        ? await postJsonIpv4(url, payload, timeoutMs)
        : await fetchImpl(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(timeoutMs),
        });
    } catch (error) {
      if (attempt === 0 && (error instanceof TypeError || error.name === 'TimeoutError')) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        continue;
      }
      const code = error.cause?.code || error.cause?.errors?.map((item) => item.code).filter(Boolean).join(',');
      throw new Error(`${targetName} request failed: ${error.message}${code ? ` (${code})` : ''}`, { cause: error });
    }

    if (!response.ok) {
      throw new Error(`${targetName} returned HTTP ${response.status}`);
    }
    return;
  }
}

export function createNotifier({
  webhookUrl,
  webhookType = 'generic',
  telegramBotToken = '',
  telegramChatId = '',
  fetchImpl = fetch,
  timeoutMs = 15_000,
}) {
  return {
    async notify({ creator, posts = [], listings = [] }) {
      if (posts.length === 0 && listings.length === 0) return { sent: false, targets: [] };

      const event = {
        event: listings.length ? (posts.length ? 'gank.new_content' : 'gank.new_listings') : 'gank.new_posts',
        creator: {
          id: creator.id,
          nickname: creator.nickname,
          profileUrl: `https://ganknow.com/${creator.nickname}`,
        },
        posts: posts.map((post) => ({
          id: post.id,
          title: post.title || '(ไม่มีชื่อโพสต์)',
          createdAt: post.createdAt,
          createdAtUtc7: formatUtc7(post.createdAt),
          url: postUrl(post),
        })),
        listings: listings.map((listing) => ({
          id: listing.id,
          title: listing.name || '(ไม่มีชื่อ listing)',
          createdAt: listing.createdAt,
          createdAtUtc7: formatUtc7(listing.createdAt),
          url: listingUrl(listing),
        })),
        detectedAt: new Date().toISOString(),
      };

      const deliveries = [];
      if (webhookUrl) {
        const payload = webhookType === 'discord'
          ? {
              content: `มีโพสต์ใหม่ ${posts.length} และ listing ใหม่ ${listings.length} จาก **${creator.nickname}**`,
              embeds: [
                ...posts.map((post) => ({ title: post.title || '(ไม่มีชื่อโพสต์)', url: postUrl(post), description: `โพสต์ · ${formatUtc7(post.createdAt) || '-'}`, timestamp: post.createdAt })),
                ...listings.map((listing) => ({ title: listing.name || '(ไม่มีชื่อ listing)', url: listingUrl(listing), description: `Listing · ${formatUtc7(listing.createdAt) || '-'}`, timestamp: listing.createdAt })),
              ].slice(0, 10),
            }
          : event;
        deliveries.push({
          name: webhookType === 'discord' ? 'discord' : 'webhook',
          promise: postJson(webhookUrl, payload, {
            fetchImpl,
            timeoutMs,
            targetName: 'Webhook',
          }),
        });
      }

      if (telegramBotToken && telegramChatId) {
        deliveries.push({
          name: 'telegram',
          promise: postJson(
            `https://api.telegram.org/bot${telegramBotToken}/sendMessage`,
            {
              chat_id: telegramChatId,
              text: telegramText(creator, posts, listings),
              link_preview_options: { is_disabled: true },
            },
            { fetchImpl, timeoutMs, targetName: 'Telegram', ipv4: true },
          ),
        });
      }

      await Promise.all(deliveries.map((delivery) => delivery.promise));
      return {
        sent: deliveries.length > 0,
        targets: deliveries.map((delivery) => delivery.name),
      };
    },
  };
}
