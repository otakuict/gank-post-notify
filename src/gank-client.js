const API_BASE_URL = 'https://api.ganknow.com/v1';

export function getNickname(profileUrl) {
  let url;
  try {
    url = new URL(profileUrl);
  } catch {
    throw new Error('GANK_PROFILE_URL is not a valid URL');
  }

  if (!['ganknow.com', 'www.ganknow.com'].includes(url.hostname.toLowerCase())) {
    throw new Error('GANK_PROFILE_URL must point to ganknow.com');
  }

  const nickname = url.pathname.split('/').filter(Boolean)[0];
  if (!nickname) throw new Error('GANK_PROFILE_URL does not contain a nickname');
  return decodeURIComponent(nickname);
}

export function getProfileNickname(value) {
  const trimmed = value.trim();
  if (trimmed.includes('://')) return getNickname(trimmed);
  if (!/^[A-Za-z0-9_.-]+$/.test(trimmed)) {
    throw new Error(`Invalid Gank creator nickname: ${trimmed}`);
  }
  return trimmed;
}

async function getJson(url, { fetchImpl, timeoutMs, operation }) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        headers: {
          accept: 'application/json',
          'user-agent': 'gank-post-notify/1.0',
        },
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        if (attempt === 0 && (response.status === 429 || response.status >= 500)) {
          await response.body?.cancel();
          await new Promise((resolve) => setTimeout(resolve, 500));
          continue;
        }
        throw new Error(`Gank API ${operation} returned HTTP ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      if (attempt === 0 && (error instanceof TypeError || error.name === 'TimeoutError')) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        continue;
      }
      if (error instanceof TypeError || error.name === 'TimeoutError') {
        const code = error.cause?.code;
        throw new Error(`Gank API ${operation} request failed: ${error.message}${code ? ` (${code})` : ''}`, { cause: error });
      }
      throw error;
    }
  }
}

export function createGankClient({ fetchImpl = fetch, timeoutMs = 15_000 } = {}) {
  return {
    async getCreator(nickname) {
      const url = `${API_BASE_URL}/users/nickname/${encodeURIComponent(nickname)}`;
      const body = await getJson(url, { fetchImpl, timeoutMs, operation: 'creator lookup' });
      if (!body?.data?.id) throw new Error(`Creator ${nickname} was not found`);
      return body.data;
    },

    async getLatestPosts(creatorId, perPage = 20) {
      const params = new URLSearchParams({
        author: creatorId,
        page: '1',
        perPage: String(perPage),
        orderBy: 'createdAt desc',
      });
      const body = await getJson(`${API_BASE_URL}/posts?${params}`, {
        fetchImpl,
        timeoutMs,
        operation: 'posts lookup',
      });
      if (body?.data === null) return [];
      if (!Array.isArray(body?.data)) {
        throw new Error('Gank API returned an unexpected posts response');
      }
      return body.data;
    },

    async getLatestListings(creatorId, perPage = 20) {
      const params = new URLSearchParams({
        userId: creatorId,
        page: '1',
        per_page: String(perPage),
        isActive: 'true',
        order_by: 'createdAt desc',
      });
      const body = await getJson(`${API_BASE_URL}/catalogs/services?${params}`, {
        fetchImpl,
        timeoutMs,
        operation: 'listings lookup',
      });
      if (body?.data === null) return [];
      if (!Array.isArray(body?.data)) {
        throw new Error('Gank API returned an unexpected listings response');
      }
      return body.data;
    },
  };
}
