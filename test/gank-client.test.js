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

test('client requests active listings newest first using Gank query names', async () => {
  let requestedUrl;
  const client = createGankClient({
    fetchImpl: async (url) => {
      requestedUrl = new URL(url);
      return { ok: true, json: async () => ({ data: [] }) };
    },
  });

  await client.getLatestListings('creator id', 12);
  assert.equal(requestedUrl.pathname, '/v1/catalogs/services');
  assert.equal(requestedUrl.searchParams.get('userId'), 'creator id');
  assert.equal(requestedUrl.searchParams.get('per_page'), '12');
  assert.equal(requestedUrl.searchParams.get('order_by'), 'createdAt desc');
  assert.equal(requestedUrl.searchParams.get('isActive'), 'true');
});

test('client treats a null posts response as an empty creator feed', async () => {
  const client = createGankClient({
    fetchImpl: async () => ({ ok: true, json: async () => ({ data: null }) }),
  });
  assert.deepEqual(await client.getLatestPosts('creator-without-posts'), []);
});

test('client retries a transient creator request failure', async () => {
  let attempts = 0;
  const client = createGankClient({
    fetchImpl: async () => {
      attempts += 1;
      if (attempts === 1) throw new TypeError('fetch failed');
      return { ok: true, json: async () => ({ data: { id: 'creator-1' } }) };
    },
  });

  assert.equal((await client.getCreator('baemonfan')).id, 'creator-1');
  assert.equal(attempts, 2);
});

test('client retries HTTP 429 once', async () => {
  let attempts = 0;
  const client = createGankClient({
    fetchImpl: async () => {
      attempts += 1;
      if (attempts === 1) return { ok: false, status: 429 };
      return { ok: true, json: async () => ({ data: [] }) };
    },
  });

  assert.deepEqual(await client.getLatestPosts('creator-1'), []);
  assert.equal(attempts, 2);
});

test('client identifies a persistent network error and does not retry HTTP 404', async () => {
  let attempts = 0;
  const client = createGankClient({
    fetchImpl: async () => {
      attempts += 1;
      throw new TypeError('fetch failed', { cause: { code: 'ECONNRESET' } });
    },
  });

  await assert.rejects(client.getLatestPosts('creator-1'), /posts lookup request failed: fetch failed \(ECONNRESET\)/);
  assert.equal(attempts, 2);

  const missing = createGankClient({
    fetchImpl: async () => {
      attempts += 1;
      return { ok: false, status: 404 };
    },
  });
  await assert.rejects(missing.getCreator('missing'), /creator lookup returned HTTP 404/);
  assert.equal(attempts, 3);
});
