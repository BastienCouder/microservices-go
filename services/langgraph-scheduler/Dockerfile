FROM oven/bun:1.2.22-alpine AS deps

WORKDIR /app

COPY package.json ./package.json
COPY bun.lock ./bun.lock
RUN rm -rf node_modules
RUN bun install --frozen-lockfile

FROM deps AS build

COPY tsconfig.json ./tsconfig.json
COPY src ./src
COPY proto ./proto
RUN bun run build

FROM oven/bun:1.2.22-alpine AS prod-deps

WORKDIR /app

COPY package.json ./package.json
COPY bun.lock ./bun.lock
RUN rm -rf node_modules
RUN bun install --frozen-lockfile --production

FROM gcr.io/distroless/nodejs22-debian13:nonroot

WORKDIR /app

COPY --from=build /app/package.json ./package.json
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/proto ./proto

CMD ["dist/index.js"]
