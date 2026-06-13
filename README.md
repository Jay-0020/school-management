# School Management Portal

A white-label, multi-school management portal — sold as an **isolated per-school
deployment** from a single template codebase. Market: **India**. Web-first.

See [REQUIREMENTS.md](./REQUIREMENTS.md) for the full spec.

## Stack

| Layer | Tech |
|-------|------|
| Backend | Node.js + Express + TypeScript |
| ORM / DB | Prisma + PostgreSQL |
| Frontend | React + Vite + TypeScript |
| Auth | JWT + role-based access control |

## Repo layout

```
school-management/
├── backend/          Express API (TypeScript, Prisma)
├── frontend/         React SPA (Vite, TypeScript)
├── docker-compose.yml   Local Postgres
└── REQUIREMENTS.md
```

## Local development

### 1. Start Postgres

```bash
docker compose up -d
```

### 2. Backend

```bash
cd backend
cp .env.example .env          # adjust if needed
npm install
npx prisma migrate dev        # create schema
npm run seed                  # seed admin + school branding
npm run dev                   # http://localhost:4000
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev                   # http://localhost:5173
```

## White-label model

Each school gets its own deployment. **Branding and config are never hardcoded** —
they come from environment variables plus the `SchoolSettings` table, so rebranding
for a new buyer means changing config and deploying a fresh instance from the same
image. See REQUIREMENTS.md §1.

## Status

Phase 1 (MVP) foundation — scaffolding in progress: auth/RBAC, white-label config,
core data model (students, teachers/staff, classes), per-role dashboards.
