FROM oven/bun:1-alpine AS builder

WORKDIR /app
COPY apps/doc/package.json ./
RUN bun install

COPY apps/doc .
RUN bun run build

FROM nginx:1.29-alpine AS runtime
COPY --from=builder /app/out/ /usr/share/nginx/html/
