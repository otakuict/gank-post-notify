import { formatUtc7 } from './time.js';
import { listingUrl } from './urls.js';

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
    latestListing: null,
    newPostsOnLastCheck: [],
    newListingsOnLastCheck: [],
  };

  async function performCheck() {
    const checkStartedAt = new Date().toISOString();
    let stage = 'creator lookup';
    status = {
      ...status,
      running: true,
      lastCheckedAt: checkStartedAt,
      lastCheckedAtUtc7: formatUtc7(checkStartedAt),
    };
    try {
      const creator = await client.getCreator(nickname);
      stage = 'state read';
      const previousState = await store.read();
      stage = 'posts lookup';
      const posts = await client.getLatestPosts(creator.id, postsPerPage);
      stage = 'listings lookup';
      const listings = await client.getLatestListings(creator.id, postsPerPage);
      const isFirstRun = previousState === null;
      const newPosts = isFirstRun && !notifyOnFirstRun
        ? []
        : findNewPosts(posts, previousState?.seenPostIds || []);
      const listingBaseline = previousState?.seenListingIds;
      const recentCutoff = Date.now() - 6 * 60 * 60 * 1000;
      const newListings = isFirstRun && !notifyOnFirstRun
        ? []
        : listingBaseline === null || listingBaseline === undefined
          ? listings.filter((listing) => new Date(listing.createdAt).getTime() >= recentCutoff)
          : findNewPosts(listings, listingBaseline);

      // Notify before committing the new state so a failed webhook is retried.
      stage = 'notification';
      await notifier.notify({ creator, posts: newPosts, listings: newListings });

      const now = new Date().toISOString();
      stage = 'state write';
      await store.write({
        creator: { id: creator.id, nickname: creator.nickname },
        seenPostIds: posts.map((post) => post.id),
        seenListingIds: listings.map((listing) => listing.id),
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
        latestListing: listings[0]
          ? {
              id: listings[0].id,
              title: listings[0].name,
              createdAt: listings[0].createdAt,
              createdAtUtc7: formatUtc7(listings[0].createdAt),
              url: listingUrl(listings[0]),
            }
          : null,
        newPostsOnLastCheck: newPosts.map((post) => ({
          id: post.id,
          title: post.title,
          createdAt: post.createdAt,
          createdAtUtc7: formatUtc7(post.createdAt),
          url: `https://ganknow.com/post/${post.id}`,
        })),
        newListingsOnLastCheck: newListings.map((listing) => ({
          id: listing.id,
          title: listing.name,
          createdAt: listing.createdAt,
          createdAtUtc7: formatUtc7(listing.createdAt),
          url: listingUrl(listing),
        })),
      };

      logger.info(
        `[${formatUtc7(now)}] checked @${creator.nickname}: ${newPosts.length} new post(s), ${newListings.length} new listing(s)`,
      );
      return status;
    } catch (error) {
      const errorAt = new Date().toISOString();
      status = {
        ...status,
        running: false,
        lastError: {
          message: error.message,
          stage,
          at: errorAt,
          atUtc7: formatUtc7(errorAt),
        },
      };
      logger.error(`[${status.lastError.atUtc7}] check failed @${nickname} (${stage}): ${error.message}`);
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
