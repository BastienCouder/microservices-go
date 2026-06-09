FROM oven/bun:alpine AS build

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY . ./

ARG VITE_API_BASE_URL
ARG VITE_WEB_AUTH_URL
RUN VITE_API_BASE_URL="${VITE_API_BASE_URL}" \
    VITE_WEB_AUTH_URL="${VITE_WEB_AUTH_URL}" \
    bun run build

FROM nginx:stable-alpine AS production

ENV API_GATEWAY_INTERNAL_URL=http://api-gateway:8080
ENV WEB_AUTH_URL=http://localhost:3000/auth

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx/default.conf /etc/nginx/templates/default.conf.template

CMD ["nginx", "-g", "daemon off;"]
