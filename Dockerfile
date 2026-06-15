# Single-image build: compiles the React SPA and the Express API, then runs one
# container that serves both. Used to deploy a per-school instance.
# Build context = repo root.
#
# Uses node:20-slim (Debian) + openssl so Prisma's engines work out of the box
# (the Alpine image lacks the libssl Prisma needs).

# 1) Build the frontend
FROM node:20-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# 2) Build the backend
FROM node:20-slim AS backend
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
RUN npx prisma generate && npm run build

# 3) Runtime image — full node:20 (Debian) so Prisma reliably detects OpenSSL 3.
FROM node:20 AS runtime
WORKDIR /app/backend
ENV NODE_ENV=production
# Full install (keeps the Prisma CLI) + generate the client IN this image so the
# query/schema engines match the runtime OS (debian-openssl-3.0.x).
COPY backend/package*.json ./
RUN npm ci
COPY backend/prisma ./prisma
RUN npx prisma generate
# Compiled API + built SPA (served by the API — see app.ts CLIENT_DIR)
COPY --from=backend /app/backend/dist ./dist
COPY --from=frontend /app/frontend/dist /app/frontend/dist
RUN mkdir -p uploads/notes
EXPOSE 4000
# Apply migrations, then start. (Branding/admin are seeded by provision.mjs.)
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
