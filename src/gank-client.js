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

async function getJson(url, { fetchImpl, timeoutMs }) {
  const response = await fetchImpl(url, {
    headers: {
      accept: 'application/json',
      'user-agent': 'gank-post-notify/1.0',
    },
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`Gank API returned HTTP ${response.status}`);
  }
  return response.json();
}

export function createGankClient({ fetchImpl = fetch, timeoutMs = 15_000 } = {}) {
  return {
    async getCreator(nickname) {
      const url = `${API_BASE_URL}/users/nickname/${encodeURIComponent(nickname)}`;
      const body = await getJson(url, { fetchImpl, timeoutMs });
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
      });
      if (body?.data === null) return [];
      if (!Array.isArray(body?.data)) {
        throw new Error('Gank API returned an unexpected posts response');
      }
      return body.data;
    },
  };
}
