FROM oven/bun:1-alpine AS builder

WORKDIR /app
COPY apps/web/package.json apps/web/bun.lock ./
RUN bun install --frozen-lockfile

COPY apps/web .
RUN bun run build

FROM nginx:1.29-alpine AS runtime
COPY --from=builder /app/out/ /usr/share/nginx/html/