# ---- build stage: compile TypeScript ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- runtime stage: production dependencies + compiled JS only ----
FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
# Uploads are temporary (images go to Cloudinary); the folder must be writable by the non-root user
RUN mkdir -p uploads && chown -R node:node /app
USER node
# Cloud Run / Render / Railway inject PORT; the app reads it (default 8080)
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-8080}/api/health" || exit 1
CMD ["node", "dist/index.js"]
