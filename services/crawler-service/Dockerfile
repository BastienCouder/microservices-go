FROM oven/bun:1.2.22-alpine AS deps

WORKDIR /app

COPY package.json ./package.json
COPY bun.lock ./bun.lock
RUN bun install --frozen-lockfile

FROM deps AS build

COPY tsconfig.json ./
COPY src ./src
RUN bun run build

FROM oven/bun:1.2.22-alpine AS prod-deps

WORKDIR /app

COPY package.json ./package.json
COPY bun.lock ./bun.lock
RUN bun install --frozen-lockfile --production

FROM gcr.io/distroless/nodejs22-debian13:nonroot

WORKDIR /app

COPY --from=build /app/package.json ./package.json
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

EXPOSE 8094

CMD ["dist/server.js"]
