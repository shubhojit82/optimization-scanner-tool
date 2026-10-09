FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run typecheck && npm run build

FROM node:24-bookworm-slim
ENV NODE_ENV=production GEO_BIND=0.0.0.0 PORT=8080 GEO_DATA_DIR=/app/data GEO_AUTH_MODE=basic
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && mkdir -p /app/data && chown node:node /app/data
COPY --from=build /app/dist ./dist
USER node
EXPOSE 8080
CMD ["node","dist/server/server/node-server.js"]
