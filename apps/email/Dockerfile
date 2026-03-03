FROM oven/bun:1.2.8-alpine AS base

WORKDIR /app

COPY apps/email/package.json apps/email/bun.lock ./
RUN bun install --frozen-lockfile

COPY apps/email ./

FROM base AS dev
CMD ["bun", "run", "dev"]

FROM base AS runtime
CMD ["bun", "run", "api"]
