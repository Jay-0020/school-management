# School Management Portal

A white-label, multi-school management portal. **One codebase and one running app
serve many schools** — each request is routed by hostname to that school's own
database, so schools share the app but have fully isolated data and branding.
Market: **India**. Web-first.

See [REQUIREMENTS.md](./REQUIREMENTS.md) for the full spec.

## 🏫 Onboard a new school (one command)

Each school gets its own database + branding, served by the shared app on its own
domain. To add one:

```bash
cd backend
npm run provision -- \
  --name "Springfield High" --short SHS --color "#7c3aed" \
  --admin admin@springfield.edu --password "Temp@1234" \
  --db school_springfield --host springfield.edu
```

This creates the school's database, applies migrations, seeds its branding +
admin login, and **registers it in the tenant registry** (`backend/tenants.json`)
keyed by `--host`. The one running app picks it up — **no per-school process, no
redeploy.** Point the school's domain at the server and it's live.

- **Add a school / local dev:** [ONBOARDING.md](./ONBOARDING.md)
- **Launch in production (server, domains, managed Postgres):** [GOING-LIVE.md](./GOING-LIVE.md)

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

One shared app serves every school; **branding and config are never hardcoded**.
The app resolves the school from the request **hostname** via the tenant registry
(`backend/tenants.json`), connects to that school's database, and renders its
branding from the school's `SchoolSettings` row. Adding/rebranding a school is a
data change (provision + registry entry), never a code fork or a new deployment.
A per-school JWT secret keeps tokens from crossing tenants. See
[GOING-LIVE.md](./GOING-LIVE.md) and REQUIREMENTS.md §1.

> **Single-school fallback:** with no registry but `DATABASE_URL`/`JWT_SECRET` set
> in the environment, the app serves one school on any hostname — how the hosted
> demo runs, and the simplest way to deploy a single school.

## Status

Phase 1 (MVP) foundation — scaffolding in progress: auth/RBAC, white-label config,
core data model (students, teachers/staff, classes), per-role dashboards.
