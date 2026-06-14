# Onboarding a new school (white-label provisioning)

Each school runs as its **own isolated instance** (its own database + branded
config) from this single codebase. Standing one up is one command, then deploy.

## 1. Provision the school

From `backend/`, run the provisioner with the school's details:

```bash
cd backend
npm run provision -- \
  --name "Springfield High School" \
  --short "SHS" \
  --color "#7c3aed" \
  --logo "https://cdn.example.com/springfield-logo.png" \
  --email "info@springfield.edu" \
  --phone "+91-9000000000" \
  --admin "admin@springfield.edu" \
  --password "Temp@1234" \
  --db "school_springfield"
```

Required flags: `--name`, `--admin`, `--db`. Everything else has sensible
defaults (`--color` defaults to blue, `--short` to the first 3 letters, etc.).

What it does:
- Creates the database `school_springfield`.
- Applies all migrations.
- Seeds the branded `SchoolSettings` (name, colour, logo, contact) and the
  admin login.
- Writes `backend/instances/school_springfield.env` (DB URL, a random
  `JWT_SECRET`, branding, seed admin). **This file holds secrets — it is
  git-ignored.**

Requirements: PostgreSQL client tools (`psql`) on PATH and a role that can
`CREATE DATABASE` (defaults to `school/school@localhost:5432`; override with
`PGHOST` / `PGPORT` / `PGUSER` / `PGPASSWORD` / `PSQL`).

## 2. Run / deploy it

**Locally (Node):**
```bash
cd backend
env $(grep -v '^#' instances/school_springfield.env | xargs) npm start
```

**As a container (recommended for production):**
Point `DATABASE_URL` in the env file at the compose `db` service
(`...@db:5432/school_springfield`), then:
```bash
docker compose \
  --env-file backend/instances/school_springfield.env \
  -f docker-compose.school.yml up -d --build
```
The single app image builds the React SPA and the Express API and serves both
on port 4000. Migrations run automatically on start.

## 3. Hand off

Give the school admin their URL and the login:
`admin@springfield.edu` / the password you set (they're prompted to change it
on first sign-in). They configure classes, staff, students, etc. from
**School Setup**.

## Rebranding / updating

- **Branding** (name, colour, logo, contact) is editable any time from
  **School Setup** in the app, or re-run `provision` (it reuses an existing DB).
- **New release**: pull the latest code and redeploy each instance
  (`docker compose ... up -d --build`) — migrations apply on start. Because
  every school shares one codebase, there are no per-school forks to maintain.

## Notes

- File uploads (notes, etc.) are stored on disk under `backend/uploads` (mounted
  as a Docker volume). Swap to S3-compatible storage for multi-node setups.
- Each school's data is fully isolated in its own database.
