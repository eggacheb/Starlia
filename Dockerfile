FROM oven/bun:1-alpine AS builder
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM oven/bun:1-alpine
WORKDIR /app
COPY --from=builder /app/server ./server
COPY --from=builder /app/package.json ./
COPY --from=builder /app/dist ./dist
RUN bun install --production
RUN mkdir -p /data

ENV PORT=80
ENV DATA_DIR=/data
ENV PASSWORD=changeme

EXPOSE 80
VOLUME ["/data"]
CMD ["bun", "run", "server/index.ts"]
