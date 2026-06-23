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
EXPOSE 4000
ENV NODE_ENV=production
HEALTHCHECK --interval=15s --timeout=5s --retries=3 CMD wget -qO- http://localhost:4000/api/health || exit 1
USER root
CMD ["node", "backend/dist/index.js"]
