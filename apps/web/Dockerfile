FROM oven/bun:alpine AS deps

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM deps AS build

WORKDIR /app

COPY . ./

ARG NEXT_PUBLIC_API_GATEWAY_URL=http://localhost:50000
ARG NEXT_PUBLIC_APP_URL=http://localhost:30004
ARG NEXT_PUBLIC_SITE_URL=http://localhost:30000
ARG NEXT_PUBLIC_WEB_URL=http://localhost:30000

ENV NEXT_PUBLIC_API_GATEWAY_URL="${NEXT_PUBLIC_API_GATEWAY_URL}" \
    NEXT_PUBLIC_APP_URL="${NEXT_PUBLIC_APP_URL}" \
    NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL}" \
    NEXT_PUBLIC_WEB_URL="${NEXT_PUBLIC_WEB_URL}"

RUN bun run build

FROM oven/bun:alpine AS production

WORKDIR /app

ENV NODE_ENV=production

COPY --from=build /app /app

EXPOSE 3000

CMD ["bun", "x", "next", "start", "--hostname", "0.0.0.0", "--port", "3000"]
