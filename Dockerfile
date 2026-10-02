# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS base

WORKDIR /app

# The runtime copy depends on this stage, so every image build runs the tests.
FROM base AS test
COPY package.json ./
COPY src/ ./src/
COPY test/ ./test/
RUN npm test

FROM base AS production

# There are no external dependencies or build steps.
COPY --from=test /app/package.json ./
COPY --from=test /app/src/ ./src/

RUN mkdir -p /app/data && chown node:node /app/data

USER node:node

STOPSIGNAL SIGTERM

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:3000/health', { signal: AbortSignal.timeout(4000) }).then(async r => { const body = await r.json(); process.exit(r.ok && body.profiles?.length > 0 && body.profiles.every(p => p.initialized) ? 0 : 1); }).catch(() => process.exit(1))"

CMD ["node", "src/server.js"]
