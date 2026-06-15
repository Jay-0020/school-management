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
# TS source + tsconfig so `npx tsx prisma/seed.ts` can run inside the image.
# Lets a remote deploy (Render/Fly/Railway) self-seed branding + admin on boot,
# with no local provision step — see render.yaml dockerCommand.
COPY backend/src ./src
COPY backend/tsconfig.json ./
RUN mkdir -p uploads/notes
EXPOSE 4000
# Apply migrations, seed branding + admin (idempotent), then start.
# Self-seeding so a bare `docker run`/PaaS deploy (Render/Fly) comes up ready,
# with no separate provision step. Re-runs are safe: schoolSettings is an
# upsert with no-op update, and the admin create is guarded by a lookup.
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx prisma/seed.ts && node dist/index.js"]
