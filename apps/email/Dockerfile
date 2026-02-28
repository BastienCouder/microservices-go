FROM oven/bun:1-alpine

WORKDIR /app

COPY apps/email/package.json ./
RUN bun install

COPY apps/email ./

CMD ["bun", "run", "api"]
