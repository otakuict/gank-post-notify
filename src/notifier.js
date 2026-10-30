import { formatUtc7 } from './time.js';

function postUrl(post) {
  return `https://ganknow.com/post/${post.id}`;
}

function telegramText(creator, posts) {
  const lines = [
    `🔔 มีโพสต์ใหม่จาก ${creator.nickname} จำนวน ${posts.length} โพสต์`,
    '',
  ];

  for (const [index, post] of posts.slice(0, 10).entries()) {
    lines.push(`${index + 1}. ${post.title || '(ไม่มีชื่อโพสต์)'}`);
    const localTime = formatUtc7(post.createdAt);
    if (localTime) lines.push(`เวลา: ${localTime}`);
    lines.push(postUrl(post));
    if (index < Math.min(posts.length, 10) - 1) lines.push('');
  }
  if (posts.length > 10) lines.push('', `และอีก ${posts.length - 10} โพสต์`);

  // Telegram sendMessage accepts at most 4,096 characters.
  return lines.join('\n').slice(0, 4_096);
}

async function postJson(url, payload, { fetchImpl, timeoutMs, targetName }) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let response;
    try {
      response = await fetchImpl(url, {
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
    async notify({ creator, posts }) {
      if (posts.length === 0) return { sent: false, targets: [] };

      const event = {
        event: 'gank.new_posts',
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
        detectedAt: new Date().toISOString(),
      };

      const deliveries = [];
      if (webhookUrl) {
        const payload = webhookType === 'discord'
          ? {
              content: `มีโพสต์ใหม่จาก **${creator.nickname}** จำนวน ${posts.length} โพสต์`,
              embeds: posts.slice(0, 10).map((post) => ({
              title: post.title || '(ไม่มีชื่อโพสต์)',
              url: postUrl(post),
              description: `เวลา: ${formatUtc7(post.createdAt) || '-'}`,
              timestamp: post.createdAt,
              })),
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
              text: telegramText(creator, posts),
              link_preview_options: { is_disabled: true },
            },
            { fetchImpl, timeoutMs, targetName: 'Telegram' },
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
