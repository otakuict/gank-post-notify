import { formatUtc7 } from './time.js';

export function findNewPosts(posts, seenPostIds) {
  const seen = new Set(seenPostIds);
  return posts.filter((post) => post?.id && !seen.has(post.id));
}

export function createChecker({
  nickname,
  postsPerPage,
  notifyOnFirstRun,
  client,
  store,
  notifier,
  logger = console,
}) {
  let runningPromise = null;
  let status = {
    running: false,
    nickname,
    creatorId: null,
    initialized: false,
    lastCheckedAt: null,
    lastSuccessAt: null,
    lastError: null,
    latestPost: null,
    newPostsOnLastCheck: [],
  };

  async function performCheck() {
    const checkStartedAt = new Date().toISOString();
    status = {
      ...status,
      running: true,
      lastCheckedAt: checkStartedAt,
      lastCheckedAtUtc7: formatUtc7(checkStartedAt),
    };
    try {
      const [creator, previousState] = await Promise.all([
        client.getCreator(nickname),
        store.read(),
      ]);
      const posts = await client.getLatestPosts(creator.id, postsPerPage);
      const isFirstRun = previousState === null;
      const newPosts = isFirstRun && !notifyOnFirstRun
        ? []
        : findNewPosts(posts, previousState?.seenPostIds || []);

      // Notify before committing the new state so a failed webhook is retried.
      await notifier.notify({ creator, posts: newPosts });

      const now = new Date().toISOString();
      await store.write({
        creator: { id: creator.id, nickname: creator.nickname },
        seenPostIds: posts.map((post) => post.id),
        lastCheckedAt: now,
      });

      status = {
        ...status,
        running: false,
        creatorId: creator.id,
        initialized: true,
        lastSuccessAt: now,
        lastSuccessAtUtc7: formatUtc7(now),
        lastError: null,
        latestPost: posts[0]
          ? {
              id: posts[0].id,
              title: posts[0].title,
              createdAt: posts[0].createdAt,
              createdAtUtc7: formatUtc7(posts[0].createdAt),
              url: `https://ganknow.com/post/${posts[0].id}`,
            }
          : null,
        newPostsOnLastCheck: newPosts.map((post) => ({
          id: post.id,
          title: post.title,
          createdAt: post.createdAt,
          createdAtUtc7: formatUtc7(post.createdAt),
          url: `https://ganknow.com/post/${post.id}`,
        })),
      };

      logger.info(
        `[${formatUtc7(now)}] checked @${creator.nickname}: ${newPosts.length} new post(s)`,
      );
      return status;
    } catch (error) {
      const errorAt = new Date().toISOString();
      status = {
        ...status,
        running: false,
        lastError: {
          message: error.message,
          at: errorAt,
          atUtc7: formatUtc7(errorAt),
        },
      };
      logger.error(`[${status.lastError.atUtc7}] check failed: ${error.message}`);
      throw error;
    }
  }

  return {
    check() {
      if (!runningPromise) {
        runningPromise = performCheck().finally(() => {
          runningPromise = null;
        });
      }
      return runningPromise;
    },
    getStatus() {
      return structuredClone(status);
    },
  };
}
