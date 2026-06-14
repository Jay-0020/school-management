# Single-image build: compiles the React SPA and the Express API, then runs one
# container that serves both. Used to deploy a per-school instance.
# Build context = repo root.

# 1) Build the frontend
FROM node:20-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# 2) Build the backend
FROM node:20-alpine AS backend
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
RUN npx prisma generate && npm run build

# 3) Runtime image
FROM node:20-alpine AS runtime
WORKDIR /app/backend
ENV NODE_ENV=production
# Backend production deps + prisma client + compiled JS
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY --from=backend /app/backend/node_modules/.prisma ./node_modules/.prisma
COPY --from=backend /app/backend/node_modules/@prisma ./node_modules/@prisma
COPY --from=backend /app/backend/dist ./dist
COPY backend/prisma ./prisma
# Built SPA, served by the API (see app.ts CLIENT_DIR)
COPY --from=frontend /app/frontend/dist /app/frontend/dist
RUN mkdir -p uploads/notes
EXPOSE 4000
# Apply migrations, then start. (Branding/admin are seeded by provision.mjs.)
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
