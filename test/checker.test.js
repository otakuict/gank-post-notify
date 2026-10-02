import test from 'node:test';
import assert from 'node:assert/strict';
import { createChecker, findNewPosts } from '../src/checker.js';

test('findNewPosts returns only unseen posts in API order', () => {
  const posts = [{ id: 'new-2' }, { id: 'new-1' }, { id: 'old' }];
  assert.deepEqual(findNewPosts(posts, ['old']), [posts[0], posts[1]]);
});

test('first run creates a baseline without notifying by default', async () => {
  let saved;
  const notifications = [];
  const checker = createChecker({
    nickname: 'baemonfan',
    postsPerPage: 20,
    notifyOnFirstRun: false,
    client: {
      getCreator: async () => ({ id: 'creator-1', nickname: 'baemonfan' }),
      getLatestPosts: async () => [
        { id: 'post-1', title: 'Existing', createdAt: '2026-01-01T00:00:00Z' },
      ],
    },
    store: {
      read: async () => null,
      write: async (state) => { saved = state; },
    },
    notifier: {
      notify: async (event) => { notifications.push(event); },
    },
    logger: { info() {}, error() {} },
  });

  const status = await checker.check();
  assert.deepEqual(status.newPostsOnLastCheck, []);
  assert.match(status.lastCheckedAtUtc7, /\(UTC\+7\)$/);
  assert.match(status.lastSuccessAtUtc7, /\(UTC\+7\)$/);
  assert.deepEqual(notifications[0].posts, []);
  assert.deepEqual(saved.seenPostIds, ['post-1']);
});

test('a later run notifies unseen posts before saving state', async () => {
  const calls = [];
  const checker = createChecker({
    nickname: 'baemonfan',
    postsPerPage: 20,
    notifyOnFirstRun: false,
    client: {
      getCreator: async () => ({ id: 'creator-1', nickname: 'baemonfan' }),
      getLatestPosts: async () => [
        { id: 'new', title: 'New post', createdAt: '2026-01-02T00:00:00Z' },
        { id: 'old', title: 'Old post', createdAt: '2026-01-01T00:00:00Z' },
      ],
    },
    store: {
      read: async () => ({ seenPostIds: ['old'] }),
      write: async () => { calls.push('save'); },
    },
    notifier: {
      notify: async ({ posts }) => { calls.push(`notify:${posts[0].id}`); },
    },
    logger: { info() {}, error() {} },
  });

  const status = await checker.check();
  assert.deepEqual(calls, ['notify:new', 'save']);
  assert.equal(status.newPostsOnLastCheck[0].id, 'new');
});
