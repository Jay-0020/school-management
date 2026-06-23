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

## My two go-to setups (step by step)

Two preferred options, with full recipes. **Both run the exact same app/flow** —
the only difference is where the database lives. (~₹85/$, approximate; verify at signup.)

| | **A. Hostinger 8GB + self-hosted Postgres** | **B. DigitalOcean droplet + managed Postgres** |
|---|---|---|
| App box | Hostinger KVM 2 (2 vCPU / 8 GB / 100 GB) ~$8–10 | DO droplet (2 vCPU / 4 GB) ~$12–24 |
| Database | self-hosted on the same box — **$0** | DO Managed Postgres ~$15 |
| **Total / month** | **~$8–10 (≈ ₹680–850)** | **~$27–39 (≈ ₹2,300–3,300)** |
| DB ops (backups/updates) | **you** | **provider (automatic)** |
| Best for | cheapest; early / few schools (1–5) | a handful+ of paying schools; hands-off DB |
| India region | Hostinger **Mumbai** (DB co-located = fastest) | droplet + DB both in **Bangalore** |

Cost is **flat whether 2 or 15 schools** (one box serves all). At 15 schools that
infra is ~2–10% of revenue, so option B's managed DB becomes an easy call.
**Free managed tiers (Neon/Supabase free) are demo-only** — they pause when idle
and cap storage at ~0.5 GB, so don't run real schools on them.

> **Rule:** keep the app and database in the **same region** (both Mumbai, or
> both Bangalore). Don't pair an India app with a Singapore DB — every query pays
> the cross-region latency.

### Recipe A — Hostinger 8GB + self-hosted Postgres

1. **Buy** a Hostinger **VPS → KVM 2 (8 GB)**, OS **Ubuntu** (pick the "Ubuntu +
   Docker" template if offered), region **Mumbai (India)**.
2. **SSH in** from your Mac (`ssh root@<server-ip>`) and install Docker +
   docker compose (skip if the Docker template did it). Install **Caddy** for TLS.
3. **Clone** the repo: `git clone https://github.com/Jay-0020/school-management.git`
4. **Run Postgres + the app together** (so they share a Docker network and the app
   reaches the DB by name). Use a compose with a `postgres:16` service (named
   volume for its data, a strong password) plus the app from `docker-compose.app.yml`.
   *(Ask me to generate this exact `docker-compose.selfhost.yml` — it wires the app's
   DB host to the `db` service and persists both the DB volume and the uploads volume.)*
5. **Provision each school** from **inside the app container** (so the DB hostname
   matches what the app uses): `docker compose exec app npm run provision -- --name "…" --admin "…" --db school_x --host x.edu` with `PGHOST=db`. It creates the DB,
   migrates, seeds, and registers the school in `tenants.json`.
6. **Point each school's domain** at the server (DNS A record) and add it to the
   Caddyfile; reload Caddy.
7. **Restart the app** if it was already running (it loads the registry at startup).
8. **Set up backups (critical — you own this):** a `pg_dump` cron pushed off-server
   (e.g. `rclone` to Backblaze B2 / S3), **and** back up the uploads volume. See the
   Backups section below.

### Recipe B — DigitalOcean droplet + managed Postgres

1. **Create a Droplet** — Ubuntu, region **Bangalore (BLR1)**, 2 vCPU / 4 GB.
2. **Create a Managed Postgres** (DO → Databases) in the **same Bangalore region**.
   Copy its connection details; under the DB's **Trusted Sources**, add the droplet
   so only it can connect.
3. **SSH into the droplet**, install Docker + docker compose + **Caddy**.
4. **Clone** the repo.
5. **Provision each school against the managed DB** (run on the droplet host):
   ```bash
   cd backend
   PGHOST=<managed-host> PGPORT=<port> PGUSER=<user> PGPASSWORD=<pw> PGSSLMODE=require \
   npm run provision -- --name "…" --admin "…" --db school_x --host x.edu
   ```
   ⚠️ Managed Postgres **requires SSL** — keep `PGSSLMODE=require`, and make sure the
   `databaseUrl` written to `tenants.json` ends with `?sslmode=require` (ask me to
   confirm the provisioner appends it; if not, it's a one-line tweak).
6. **Run the app:** `docker compose -f docker-compose.app.yml up -d --build` (it reads
   `tenants.json`; the managed DB is reachable from both host and container, so no
   networking gotcha here).
7. **Point each school's domain** at the droplet (DNS) + add to Caddy; reload.
8. **Backups:** the managed DB's **automatic backups** (turn them on in the DO
   dashboard) cover the database. You still **back up the uploads volume** on the
   droplet yourself.

> Either recipe: the **uploads volume must be persisted + backed up** (photos/files
> live there, separate from the DB). And run `npm run migrate:all` to apply future
> schema migrations across every school DB.

I can generate the exact compose files, Caddyfile, and backup cron for whichever
option you pick — just say which.

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

### Backups — where they go & how to set them up

**Golden rule:** a backup must live **somewhere other than the server it came
from.** A dump sitting on the same box is *not* a backup — if the box dies, it
dies too. Backups never land on your laptop automatically; you choose a
destination.

**If you use a managed Postgres (Neon / Supabase / DigitalOcean / Azure):**
backups are **automatic and stored in the provider's cloud** — just turn them on
in their dashboard and set a retention window. Nothing to run, nothing on your
device. (Recommended — least to manage.)

**If you self-host Postgres on the VPS:** nothing is backed up until you set it
up. Dump on a schedule **and push the dump off the server** to cheap object
storage (Backblaze B2 / S3 / etc.). Example daily cron (`crontab -e`):
```bash
# 2 AM daily: dump every school DB, then upload off-server, then prune local copies
0 2 * * * cd /opt/school-management/backend && \
  for url in $(node -e "JSON.parse(require('fs').readFileSync('tenants.json')).tenants.forEach(t=>console.log(t.databaseUrl))"); do \
    pg_dump "$url" | gzip > /var/backups/$(date +\%F)-$(echo "$url" | sed 's#.*/##;s#?.*##').sql.gz ; \
  done && \
  rclone copy /var/backups remote:school-backups && \
  find /var/backups -mtime +7 -delete
```
(`rclone` is a one-binary tool that uploads to B2/S3/Drive/etc. Configure it once
with `rclone config`.) Keep a copy on your device too if you like — but the
**off-site cloud copy is the real safety net**, not your laptop.

**Don't forget the uploads volume.** Photos / note files live on disk separately
from the DB, so back up `backend/uploads` the same way (e.g. `rclone copy` the
volume, or snapshot it). The DB backup alone does **not** include these files.

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
