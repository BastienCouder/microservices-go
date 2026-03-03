FROM oven/bun:1.2.8-alpine AS dev

WORKDIR /app

COPY apps/doc/package.json apps/doc/bun.lock ./
RUN bun install --frozen-lockfile

CMD ["bun", "run", "dev", "--hostname", "0.0.0.0", "--port", "3001"]

FROM oven/bun:1.2.8-alpine AS builder

WORKDIR /app
COPY apps/doc/package.json apps/doc/bun.lock ./
RUN bun install --frozen-lockfile

COPY apps/doc ./
RUN bun run build

FROM nginx:1.27.4-alpine AS runtime

COPY apps/doc/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/out /usr/share/nginx/html

RUN chown -R nginx:nginx /usr/share/nginx/html \
    && chown -R nginx:nginx /var/cache/nginx \
    && chown -R nginx:nginx /var/log/nginx \
    && touch /var/run/nginx.pid \
    && chown nginx:nginx /var/run/nginx.pid

USER nginx
CMD ["nginx", "-g", "daemon off;"]
