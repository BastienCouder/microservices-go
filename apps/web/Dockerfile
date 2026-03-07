FROM oven/bun:alpine AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM oven/bun:alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_API_GATEWAY_URL=http://localhost:50000
ARG NEXT_PUBLIC_APP_URL=http://localhost:30004
ENV NEXT_PUBLIC_API_GATEWAY_URL=${NEXT_PUBLIC_API_GATEWAY_URL}
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}

RUN bun run build

FROM gcr.io/distroless/nodejs22-debian12 AS runner
WORKDIR /app

ARG NEXT_PUBLIC_API_GATEWAY_URL=http://localhost:50000
ARG NEXT_PUBLIC_APP_URL=http://localhost:30004

ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_API_GATEWAY_URL=${NEXT_PUBLIC_API_GATEWAY_URL}
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ENV KRATOS_PUBLIC_PROXY_URL=http://kratos:4433

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

CMD ["server.js"]
