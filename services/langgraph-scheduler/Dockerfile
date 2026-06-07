FROM oven/bun:1.2.22-alpine AS deps

WORKDIR /app

COPY services/langgraph-scheduler/package.json ./package.json
COPY services/langgraph-scheduler/bun.lock ./bun.lock
RUN bun install --frozen-lockfile

FROM deps AS build

COPY services/langgraph-scheduler/tsconfig.json ./tsconfig.json
COPY services/langgraph-scheduler/src ./src
COPY services/contracts/proto ./proto
RUN bun run build

FROM oven/bun:1.2.22-alpine AS prod-deps

WORKDIR /app

COPY services/langgraph-scheduler/package.json ./package.json
COPY services/langgraph-scheduler/bun.lock ./bun.lock
RUN bun install --frozen-lockfile --production

FROM gcr.io/distroless/nodejs22-debian12:nonroot

WORKDIR /app

COPY --from=build /app/package.json ./package.json
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/proto ./proto

CMD ["dist/index.js"]
