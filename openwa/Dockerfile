FROM ghcr.io/puppeteer/puppeteer:22 AS builder
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
RUN git clone --depth 1 https://github.com/rmyndharis/OpenWA.git .
RUN npm install archiver@6 sqlite3 better-sqlite3 --save
RUN npm install
RUN npm run build

# Patch: add API_MASTER_KEY support to auth service
COPY patch-auth.js /app/patch-auth.js
RUN node /app/patch-auth.js || echo "WARN: patch-auth.js failed, continuing"

FROM ghcr.io/puppeteer/puppeteer:22
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
ENV NODE_ENV=production
WORKDIR /app
USER root
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/tsconfig.build.json ./
COPY --from=builder /app/nest-cli.json ./
COPY --from=builder /app/src ./src
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh && mkdir -p /app/data/sessions /app/data/media
EXPOSE 2785
HEALTHCHECK --interval=15s --timeout=5s --retries=3 CMD wget -qO- http://localhost:2785/api/health || exit 1
ENTRYPOINT ["/entrypoint.sh"]