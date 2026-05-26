FROM node:22-alpine AS builder
RUN apk add --no-cache git
WORKDIR /app
RUN git clone --depth 1 https://github.com/rmyndharis/OpenWA.git .
RUN npm install
RUN npm run build

FROM node:22-alpine
RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/tsconfig.build.json ./
COPY --from=builder /app/nest-cli.json ./
COPY --from=builder /app/src ./src
COPY --from=builder /app/plugins ./plugins
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
RUN mkdir -p /app/data/sessions /app/data/media /app/data/plugins
EXPOSE 2785
HEALTHCHECK --interval=15s --timeout=5s --retries=3 CMD wget -qO- http://localhost:2785/api/health || exit 1
ENTRYPOINT ["/entrypoint.sh"]
