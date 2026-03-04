FROM oven/bun:1-alpine AS builder

WORKDIR /app
COPY package.json bun.lock ./
RUN bun install

COPY . .
RUN bun run build

FROM oven/bun:1-alpine AS runtime
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

CMD ["bun", "server.js"]