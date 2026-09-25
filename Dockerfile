FROM node:24.21.0-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY tsconfig.json ./
COPY src ./src
COPY tests ./tests
RUN npm test && npm audit --omit=dev --audit-level=high && npm run build

FROM node:24.21.0-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/package.json ./
RUN mkdir -p /app/.runtime && chown node:node /app/.runtime
USER node
EXPOSE 8084
CMD ["node", "dist/src/index.js"]
