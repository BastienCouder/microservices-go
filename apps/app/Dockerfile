FROM oven/bun:1.2.8-alpine AS dev

WORKDIR /app

COPY apps/app/package.json apps/app/bun.lock ./
RUN bun install --frozen-lockfile

CMD ["bun", "run", "dev", "--host", "0.0.0.0", "--port", "5173"]

FROM oven/bun:1.2.8-alpine AS builder
WORKDIR /app

ARG VITE_API_BASE_URL
ARG VITE_WEB_AUTH_URL

COPY apps/app/package.json apps/app/bun.lock ./
RUN bun install --frozen-lockfile

COPY apps/app ./
RUN VITE_API_BASE_URL="${VITE_API_BASE_URL}" \
    VITE_WEB_AUTH_URL="${VITE_WEB_AUTH_URL}" \
    bun run build

FROM nginx:1.27.4-alpine AS runtime

COPY apps/app/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

RUN chown -R nginx:nginx /usr/share/nginx/html \
    && chown -R nginx:nginx /var/cache/nginx \
    && chown -R nginx:nginx /var/log/nginx \
    && touch /var/run/nginx.pid \
    && chown nginx:nginx /var/run/nginx.pid

USER nginx
CMD ["nginx", "-g", "daemon off;"]
