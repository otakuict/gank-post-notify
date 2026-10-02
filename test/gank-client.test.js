import test from 'node:test';
import assert from 'node:assert/strict';
import { createGankClient, getNickname, getProfileNickname } from '../src/gank-client.js';

test('getNickname extracts the creator nickname', () => {
  assert.equal(getNickname('https://ganknow.com/baemonfan'), 'baemonfan');
  assert.equal(getNickname('https://www.ganknow.com/baemonfan?tab=feed'), 'baemonfan');
});

test('getNickname rejects non-Gank URLs', () => {
  assert.throws(() => getNickname('https://example.com/baemonfan'), /ganknow\.com/);
});

test('getProfileNickname accepts a nickname or a Gank profile URL', () => {
  assert.equal(getProfileNickname('k9kingdata'), 'k9kingdata');
  assert.equal(getProfileNickname('https://ganknow.com/baemonfan'), 'baemonfan');
  assert.throws(() => getProfileNickname('../invalid'), /Invalid Gank creator nickname/);
});

test('client builds the public posts request', async () => {
  let requestedUrl;
  const client = createGankClient({
    fetchImpl: async (url) => {
      requestedUrl = new URL(url);
      return { ok: true, json: async () => ({ data: [] }) };
    },
  });

  await client.getLatestPosts('creator id', 12);
  assert.equal(requestedUrl.pathname, '/v1/posts');
  assert.equal(requestedUrl.searchParams.get('author'), 'creator id');
  assert.equal(requestedUrl.searchParams.get('perPage'), '12');
  assert.equal(requestedUrl.searchParams.get('orderBy'), 'createdAt desc');
});

test('client treats a null posts response as an empty creator feed', async () => {
  const client = createGankClient({
    fetchImpl: async () => ({ ok: true, json: async () => ({ data: null }) }),
  });
  assert.deepEqual(await client.getLatestPosts('creator-without-posts'), []);
});
