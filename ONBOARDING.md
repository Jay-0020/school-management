# Onboarding a new school (white-label provisioning)

**One app serves every school.** Each school has its own database + branding and
is reached on its own hostname; the shared app routes each request to the right
school by hostname. Adding a school is one command — it creates the DB, seeds
branding + admin, and registers the school. **No per-school process, no redeploy.**

> Production launch (server, domains, managed Postgres, reverse proxy) is covered
> separately in **[GOING-LIVE.md](./GOING-LIVE.md)**. This doc is the per-school
> provisioning step + local development.

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
  --db "school_springfield" \
  --host "springfield.edu"
```

Required flags: `--name`, `--admin`, `--db`. Everything else has sensible
defaults (`--color` → blue, `--short` → first 3 letters, `--host` →
`<db without "school_">.localhost` for local dev).

What it does:
- Creates the database `school_springfield`.
- Applies all migrations.
- Seeds the branded `SchoolSettings` (name, colour, logo, contact) and the
  admin login.
- **Registers the school in the tenant registry** `backend/tenants.json` —
  `{ host, db, databaseUrl, jwtSecret, name }`. This is what the app routes on.
  **This file holds secrets — it is git-ignored.**
- Also writes `backend/instances/<db>.env` (handy for running that DB in
  isolation / debugging).

Requirements: PostgreSQL client tools (`psql`) on PATH and a role that can
`CREATE DATABASE` (defaults to `school/school@localhost:5432`; override with
`PGHOST` / `PGPORT` / `PGUSER` / `PGPASSWORD` / `PSQL` — point these at your
production Postgres when onboarding live schools).

## 2. Run the app (serves ALL schools)

You run the app **once**; it serves every registered school. It reads
`tenants.json` at startup.

**Locally (Node):**
```bash
cd backend
npm run dev          # http://localhost:4000, serves all registered schools
```

**As a container (production):** see [GOING-LIVE.md](./GOING-LIVE.md) —
`docker compose -f docker-compose.app.yml up -d --build`.

> If the app was already running when you provisioned a new school, **restart it**
> so it reloads the registry (the registry is read at startup).

## 3. Reach a school by its hostname

The app picks the school from the request's hostname:

- **Production:** point the school's domain (`springfield.edu`) at the server
  (DNS), add it to your reverse proxy, done. See GOING-LIVE.md.
- **Local dev:** use the `*.localhost` host the provisioner assigned, e.g.
  `http://springfield.localhost:4000`. Chrome resolves `*.localhost`
  automatically; from the CLI use a Host header:
  ```bash
  curl -H "Host: springfield.localhost" http://127.0.0.1:4000/api/school/settings
  ```

An unknown hostname (not in the registry) returns
`404 {"error":"Unknown school domain."}` on API routes.

## 4. Hand off

Give the school admin their URL and the login:
`admin@springfield.edu` / the password you set (they're prompted to change it
on first sign-in). They configure classes, staff, students, etc. from
**School Setup**.

## Rebranding / updating

- **Branding** (name, colour, logo, contact) is editable any time from
  **School Setup** in the app, or re-run `provision` (it reuses an existing DB
  and updates the registry entry in place).
- **Shipping a fix/release:** because every school shares one app and one
  codebase, you deploy **once** and all schools get it — pull the latest code and
  redeploy the single app. No per-school forks, no per-school redeploys.

## Single-school / demo shortcut

If you only need **one** school (or a quick demo), you can skip the registry
entirely: set `DATABASE_URL`, `JWT_SECRET`, and the `SCHOOL_*` env vars, and the
app serves that one school on **any** hostname (the "single-tenant fallback").
This is how the hosted demo runs.

## Notes

- Each school's data is fully isolated in its own database.
- A **per-school JWT secret** (stored in the registry) means a token issued for
  one school is rejected by another.
- File uploads (notes, etc.) are stored on disk under `backend/uploads` (mount it
  as a volume in production). Swap to S3-compatible storage for multi-node setups.
- Online fee payments are not yet per-school — see the note in
  [GOING-LIVE.md](./GOING-LIVE.md) and [RAZORPAY_SETUP.md](./RAZORPAY_SETUP.md).
