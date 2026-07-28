FROM node:22-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app
COPY package.json ./
COPY backend/package.json backend/
COPY backend/prisma backend/prisma
COPY frontend/package.json frontend/
RUN npm install 2>&1
COPY . .
RUN npm run build 2>&1

FROM node:22-alpine
RUN apk add --no-cache openssl wget
WORKDIR /app
COPY --from=builder /app/backend/dist backend/dist
COPY --from=builder /app/backend/node_modules backend/node_modules
COPY --from=builder /app/backend/prisma backend/prisma
COPY --from=builder /app/frontend/dist frontend/dist
COPY --from=builder /app/backend/package.json backend/
COPY --from=builder /app/package.json ./

# Instalar ngrok
RUN wget -q https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz -O /tmp/ngrok.tgz && \
    tar xzf /tmp/ngrok.tgz -C /usr/bin/ && \
    chmod +x /usr/bin/ngrok && \
    rm /tmp/ngrok.tgz

EXPOSE 4000
ENV NODE_ENV=production
HEALTHCHECK --interval=15s --timeout=5s --retries=3 CMD wget -qO- http://localhost:4000/api/health || exit 1
USER root
# Inicia Express y luego ngrok en background con subdominio fijo
CMD ["sh", "-c", "node backend/dist/index.js & NGROK_AUTHTOKEN=${NGROK_AUTHTOKEN} ngrok http 4000 --domain=${NGROK_DOMAIN} --log /tmp/ngrok.log & wait"]
