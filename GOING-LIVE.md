# Going Live — Launching a Real School in Production

This is the end-to-end guide for taking the portal from "works on my machine" to
"a real school is using it on their own domain." Read [ONBOARDING.md](./ONBOARDING.md)
first for the day-to-day "add a school" command; this doc covers the **production
infrastructure** around it.

## The model in one picture

```
   springfield.edu  ─┐
   oakwood.edu       ─┼──────►  ONE app (one server)  ──►  resolves school by hostname
   riverdale.edu     ─┘            (reads tenant registry)        │
                                                                  ├─ DB: school_springfield
                                                                  ├─ DB: school_oakwood
                                                                  └─ DB: school_riverdale
```

- **One codebase, one running app, one server.** Not one server per school.
- **One database per school** (full data isolation) on a shared Postgres.
- **Each school's domain points at the same app.** The app reads the incoming
  hostname and connects to that school's database.
- **Adding a school needs no redeploy** — create its DB + add a registry entry,
  point its domain at the server. Fixing a bug = deploy the one app once; every
  school gets it.

---

## What you'll need (the shopping list)

| # | Thing | Who provides it | Notes |
|---|-------|-----------------|-------|
| 1 | **A server** (VPS / cloud box) | The client | Linux, Docker installed. A small box handles many schools. Needs a public IP + ports 80/443. |
| 2 | **A Postgres database** | The client (managed) or on the same box | Managed (Neon / Supabase / RDS / DigitalOcean) is recommended over self-hosted. One DB *per school* lives here. |
| 3 | **A domain per school** | Each school | The school buys/owns it. You just need them to point DNS at the server (an A record, or a CNAME). |
| 4 | **TLS certificates** | Auto (Caddy / Cloudflare / your reverse proxy) | One per domain; handled automatically by the reverse proxy below. |
| 5 | **(Optional) A Razorpay account per school** | Each school | Only if online fee payment is wanted. See the limitation note at the bottom. |

You do **not** need: a separate server per school, a domain of your own, or any
per-school code changes.

---

## Choosing a platform & what it costs

This is **cloud** hosting — a *rented* virtual server + managed database, billed
monthly, **no hardware to buy**. (A physical / on-premise server means buying
hardware up front and running power, cooling, uptime and backups yourself —
overkill here; only consider it for strict data-residency rules or very large
scale.)

**Recommended shape on any cloud: one small VM + managed Postgres, Dockerized,
with Caddy for TLS.** It maps 1:1 to this guide, and the `tenants.json` file
registry works on the VM's persistent disk.

### Cost comparison

Approximate **mid-2026 pay-as-you-go** prices, ~₹85/$, for the **whole setup**
(one box serves *many* schools — **not** per-school). Confirm on each provider's
calculator.

| Stack | Compute (the app) | Managed Postgres | **Total / month** | Best for |
|-------|-------------------|------------------|-------------------|----------|
| **A. Hetzner VPS + Neon** | CX22 (2 vCPU/4GB) ~$6 | Neon free (or self-host on VM) ~$0 | **~$6 (≈ ₹500)** | Cheapest, max margin; you manage the box |
| **B. DigitalOcean + DO Managed PG** | 2 vCPU/4GB ~$24 | ~$15 | **~$39 (≈ ₹3,300)** | Simple, fully managed |
| **C. Azure VM + PG Flexible Server** | B2s ~$36 pay-go / ~$22 reserved | Burstable B1ms ~$25 | **~$61 pay-go / ~$47 reserved (≈ ₹4,000–5,200)** | Client is an Azure / enterprise shop; India regions |
| **D. Render (paid)** | Standard web ~$25 | ~$7–19 | **~$32–44 (≈ ₹2,700–3,700)** | Least ops, push-to-deploy built in; pricier than a VPS |
| **E. Hostinger VPS** | KVM 2 (2 vCPU/8GB) ~$7–10 | self-host on VPS ~$0, or Neon free ~$0 | **~$7–10 (≈ ₹600–850)** | Cheapest with India data centers; budget-tier support; **no managed DB** |

**Free / not on this bill:** TLS (Caddy + Let's Encrypt), CI/CD (GitHub Actions
free tier + GHCR), and per-school **domains** (each school buys its own,
~₹800–1,000/yr).

**Margin:** against a **₹1,500–3,000 / school / month** fee, even the Azure stack
(~₹5k total) is covered by ~2–3 schools — every school after that is near-pure
margin because the box is shared. Scale by bumping the VM size (vertical), not
per school.

### Which to pick
- **Cost-sensitive / your call →** Hetzner + Neon (cheapest; you manage the box —
  light work with Docker + Caddy).
- **Managed simplicity →** DigitalOcean (~₹3.3k flat, everything managed).
- **Client mandates Azure →** Azure VM + PG Flexible Server; buy **1-year
  reserved** instances (~40% off).
- **Avoid Render *free*** for production (it sleeps and the DB expires — demo
  tier only). Render *paid* only if push-button simplicity is worth the premium.
- **Hostinger (cheap, India DCs) →** use their **VPS (KVM)** plan, **not** shared/
  cPanel hosting (that won't run Docker). Pick **8GB / 2 vCPU (KVM 2)** — the extra
  vCPU matters and the price gap is tiny. Choose **Ubuntu** as the VPS OS at signup
  (often a "Ubuntu + Docker" template); you SSH in from your Mac — nothing Linux is
  installed on the Mac. It has **no managed database**, so either self-host Postgres
  on the box (**set up your own automated `pg_dump` backups — non-negotiable**) or
  pair it with **Neon/Supabase** free (recommended, so you don't babysit the DB).

> **VPS vs hyperscaler:** Hostinger / Hetzner / DigitalOcean are cloud VPS hosts —
> cheap, you get a box, **no managed DB** (self-host or pair with Neon). AWS / Azure /
> GCP are "hyperscaler" clouds — pricier, but bundle managed Postgres, load
> balancers, autoscaling, etc. Both are "cloud" (rented, no hardware you own); for a
> single Docker + Caddy box the box behaves identically.

> **Azure VM ≠ Azure DevOps.** An *Azure VM* is the **server** (where the app
> runs). *Azure DevOps* is a **CI/CD suite** (an alternative to GitHub Actions).
> You need a server — not necessarily Azure DevOps. See the pipeline section.

---

## One-time server setup (do this once)

1. **Get the server** (client provisions it). SSH in. Install **Docker** +
   **docker compose**.

2. **Get the codebase on the server:**
   ```bash
   git clone https://github.com/Jay-0020/school-management.git
   cd school-management
   ```

3. **Have a Postgres ready** and note its admin connection details (host, port,
   user that can `CREATE DATABASE`, password). For a managed DB this is in its
   dashboard. Managed Postgres usually requires SSL — keep `sslmode=require` in
   mind for the connection strings.

4. **Put a reverse proxy in front** to terminate TLS and route every school
   domain to the app on port 4000. **Caddy** is the simplest — it gets
   certificates automatically. Example `Caddyfile`:
   ```
   springfield.edu, oakwood.edu, riverdale.edu {
       reverse_proxy localhost:4000
   }
   ```
   (Add each new school's domain to this list and reload Caddy. Cloudflare in
   front of the box works too and gives you certs + DDoS protection.)

---

## Add each school (repeat per school)

> The provisioner talks to Postgres using `PGHOST/PGPORT/PGUSER/PGPASSWORD`
> (defaults `school/school@localhost:5432`). Point those at your production
> Postgres for these commands.

1. **The school buys its domain** and points DNS at the server's IP (an `A`
   record for `springfield.edu`, and usually `www`).

2. **Provision the school** — creates its database, runs migrations, seeds its
   branding + admin, and registers it in the tenant registry (`backend/tenants.json`):
   ```bash
   cd backend
   PGHOST=<db-host> PGPORT=5432 PGUSER=<admin-user> PGPASSWORD=<pw> \
   npm run provision -- \
     --name "Springfield High School" --short SHS --color "#7c3aed" \
     --email info@springfield.edu --phone "+91-90000-00000" \
     --admin admin@springfield.edu --password "<temp-password>" \
     --db school_springfield \
     --host springfield.edu
   ```
   The `--host` is the **real domain** this school is reached at (this is the key
   the app routes on). It prints the admin login when done.

3. **Add the domain to the reverse proxy** (the `Caddyfile` above) and reload it.

4. **Restart the app** so it picks up the new registry entry (only needed if the
   app was already running before you provisioned — the registry loads at
   startup):
   ```bash
   docker compose -f docker-compose.app.yml restart app
   ```
   *(If you haven't started the app yet, just start it — see next section.)*

5. **Hand off** the URL + admin login to the school. They change the password on
   first sign-in and configure classes/staff/students from **School Setup**.

---

## Run the app

The app is one container that reads `backend/tenants.json` and connects to every
school's database. Because it serves all schools, you run it **once**.

```bash
# from the repo root
docker compose -f docker-compose.app.yml up -d --build
```

- Migrations: each school's DB is migrated by the **provisioner** at creation
  time, so the app doesn't need to migrate on boot in multi-school mode.
- The app holds one connection pool per school (created lazily on first request).
- Health check: `https://<any-school-domain>/api/health` → `{"status":"ok"}`.

> **Single-school shortcut:** if you're launching just *one* school (or a demo),
> you don't even need the registry. Set `DATABASE_URL`, `JWT_SECRET`, and the
> `SCHOOL_*` env vars and the app serves that one school on any hostname (this is
> the "single-tenant fallback"). That's exactly how the Render demo runs.

---

## Test on the server without buying domains (a full rehearsal)

You can stand up the server and prove the *entire* setup before any school owns a
domain. **This is the real deployment procedure** — every step below is identical
to onboarding a real school. The only difference when a real school goes live is
the final hostname: swap the test hostname for the school's purchased domain (a
one-line DNS change). Everything else stays the same.

Multi-tenancy routes by **hostname**, so the trick is giving each dummy school a
distinct hostname that points at the server — without buying one. Two free ways:

### Option A — `nip.io` (recommended: real hostnames + real HTTPS, any browser)

`nip.io` is free wildcard DNS: `anything.<server-ip>.nip.io` resolves to that IP.
With the server at e.g. `49.12.34.56`:

1. **Provision two dummy schools**, using nip.io hostnames as `--host`:
   ```bash
   cd backend
   PGHOST=<db-host> PGUSER=<admin> PGPASSWORD=<pw> npm run provision -- \
     --name "Springfield High" --short SHS --color "#7c3aed" \
     --admin admin@springfield.test --password "Temp@1234" \
     --db school_springfield --host springfield.49.12.34.56.nip.io

   PGHOST=<db-host> PGUSER=<admin> PGPASSWORD=<pw> npm run provision -- \
     --name "Oakwood International" --short OAK --color "#0ea5e9" \
     --admin admin@oakwood.test --password "Temp@5678" \
     --db school_oakwood --host oakwood.49.12.34.56.nip.io
   ```
2. **Add both hostnames to the reverse proxy** (Caddy gets HTTPS automatically):
   ```
   springfield.49.12.34.56.nip.io, oakwood.49.12.34.56.nip.io {
       reverse_proxy localhost:4000
   }
   ```
3. **Run the app** (`docker compose -f docker-compose.app.yml up -d --build`) and
   open each URL in any browser:
   - `https://springfield.49.12.34.56.nip.io` → Springfield, its own data/branding
   - `https://oakwood.49.12.34.56.nip.io` → Oakwood, fully isolated

   (Dashes also work if you prefer: `springfield.49-12-34-56.nip.io`.)

### Option B — `/etc/hosts` on your laptop (simplest, laptop-only, no HTTPS)

On your machine add:
```
49.12.34.56  springfield.test
49.12.34.56  oakwood.test
```
Provision with `--host springfield.test` / `--host oakwood.test`, then browse
`http://springfield.test` / `http://oakwood.test`. Works only from your laptop.

### Option C — on-server smoke test (quickest sanity check)

SSH into the server and hit the app directly with Host headers — no DNS at all:
```bash
curl -H "Host: springfield.test" http://127.0.0.1:4000/api/school/settings
curl -H "Host: oakwood.test"     http://127.0.0.1:4000/api/school/settings
```

### What the rehearsal proves (and what it doesn't)

Proven end-to-end: one app + two DBs routed by hostname, data isolation,
per-school branding, the reverse proxy, real TLS (Option A), and the full deploy
flow (Docker → `provision` → `migrate:all` → Caddy). **Not** tested: only the
final cutover to a school's *purchased* domain — which is just pointing that
domain's DNS at this same server. Nothing upstream changes.

---

## The tenant registry (`backend/tenants.json`)

This file is the source of truth for "which schools exist and how to reach them":

```json
{
  "tenants": [
    {
      "host": "springfield.edu",
      "db": "school_springfield",
      "databaseUrl": "postgresql://user:pw@db-host:5432/school_springfield?sslmode=require",
      "jwtSecret": "…per-school secret…",
      "name": "Springfield High School"
    }
  ]
}
```

- It is **gitignored** — it holds DB URLs and per-school secrets. Never commit it.
- The provisioner writes/updates it automatically; you rarely edit it by hand.
- It lives on the server's disk. On a real VPS (persistent disk) this is fine.
  On an ephemeral-disk host (e.g. Render free), pass the registry via the
  `TENANTS_FILE` path on a mounted volume, or graduate to the DB-table approach
  below.

### When to graduate to a control-plane database

The JSON file is great up to a modest number of schools. Once you're managing
many — or want provisioning to be "insert a row, no file, no restart" — move the
registry into a small shared **control-plane Postgres table** the app reads at
startup. The app's resolver is already centralized (`src/config/tenants.ts`), so
this is a contained change when you need it. Not required for the first schools.

---

## Backups & operations

- **Back up Postgres** (managed providers do automated backups — turn them on).
  Each school is a separate database, so restores are per-school.
- **Uploads** (notes, files) are stored on disk under `backend/uploads`. Mount it
  as a volume (the compose file does). For multi-node, switch to S3-compatible
  storage.
- **Deploying a fix:** `git pull` on the server, then
  `docker compose -f docker-compose.app.yml up -d --build`. All schools get it at
  once. No per-school redeploy.
- **Rollback:** the previous single-tenant architecture is preserved on the
  `single-tenant-legacy` branch if a client ever wants the old per-school model.

---

## Deployment pipeline (CI/CD)

The code lives on GitHub, so use **GitHub Actions** (use Azure DevOps only if the
client standardises on it). Pipeline shape:

```
push to main → CI: tsc (backend + frontend) + tests
             → build Docker image
             → push to a registry (GHCR free, or Azure Container Registry)
             → deploy: the server pulls the image and restarts the app
```

- **Quality gate first:** the `tsc --noEmit` checks (and tests) must pass before
  any deploy, so a broken build never reaches a live school.
- **Deploy step — two flavours:** simplest is an SSH action that runs
  `git pull && docker compose -f docker-compose.app.yml up -d --build` on the VM;
  cleaner is build-in-CI → push image → server just pulls (no building on the box,
  faster, reproducible).
- **Rollback:** redeploy a previous image tag, or point back at the
  `single-tenant-legacy` branch for the old single-school model.

### ⚠️ Migrations must run against EVERY school database

In multi-school mode each school's DB is migrated by the **provisioner at
creation** — the app does **not** migrate on boot. So a release that includes a
new migration must apply it to **all** school databases, not one. Add a
`migrate-all-tenants` step to the deploy that loops `tenants.json` and runs
`prisma migrate deploy` against each database. **This is the #1 thing people miss
with one-database-per-tenant** — without it, new schema reaches the app but not
the schools' data.

---

## Known limitation — online fee payments are not yet per-school

Online payment (Razorpay) keys are currently read from **global environment
variables**, not from the per-school registry. So in multi-school mode every
school would share **one** Razorpay account — which breaks the "money settles to
each school's own bank" model in [RAZORPAY_SETUP.md](./RAZORPAY_SETUP.md).

- **Single-school deploys (incl. the demo): fine** — one school, one Razorpay
  account via env.
- **Multi-school: needs a small enhancement** — carry each school's
  `RAZORPAY_KEY_ID / SECRET / WEBHOOK_SECRET` in the tenant registry and have
  `src/modules/fees/online.ts` read them from the resolved tenant instead of
  `env`. Do this before enabling online payments for multiple real schools.

(Online payment is also still pending a working Razorpay account in general — see
RAZORPAY_SETUP.md.)
