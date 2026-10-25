# Deploying StockSpace to a VPS (Docker + SSH)

This guide deploys the full stack (PostgreSQL, Fastify API, nginx-served web
app) on a Linux VPS over SSH, per the PRD's infrastructure requirements.
Estimated time: 20–30 minutes.

## 0. Prerequisites

- A VPS (Ubuntu 22.04/24.04, 1 vCPU / 1 GB RAM is enough for a small team)
- SSH key access: `ssh-copy-id user@your-server`
- A domain pointing at the server IP (optional but recommended for TLS)

## 1. Server hardening

```bash
ssh user@your-server

sudo apt update && sudo apt upgrade -y
# Basic firewall: allow SSH, HTTP, HTTPS only
sudo ufw allow OpenSSH && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp
sudo ufw enable
# Disable password login (key-only)
sudo sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo systemctl restart ssh
```

## 2. Install Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
# log out and back in for the group change to apply
docker compose version
```

## 3. Get the code and configure

```bash
sudo mkdir -p /opt/stockspace && sudo chown "$USER" /opt/stockspace
cd /opt/stockspace
git clone https://github.com/zann06/StockSpace.git .

cp .env.example .env
# REQUIRED secrets — generate real values:
openssl rand -base64 32   # → BETTER_AUTH_SECRET
nano .env
```

Minimum `.env` for production:

```env
DATABASE_URL=postgresql://stockspace:<strong-db-password>@db:5432/stockspace
BETTER_AUTH_SECRET=<generated>
BETTER_AUTH_URL=https://inventory.example.com
CORS_ORIGIN=https://inventory.example.com
```

Also change the Postgres password in `.env` **and** `docker-compose.yml`
(or use an override file) — never run with the default `stockspace` password.

> TLS: put a reverse proxy (Caddy is the simplest) in front, or extend compose
> with `ports: 80/443` + certificates. The API must be reachable at
> `BETTER_AUTH_URL` because session cookies are bound to that origin.

## 4. Start the stack

```bash
docker compose up -d --build
# The api service runs `prisma migrate deploy` before starting.
# Load the fictional demo workspace (optional — skip for production data):
docker compose exec api node ../../node_modules/.bin/../../apps/api/dist/server.js 2>/dev/null; # noop
# seeding from host is easier:
DATABASE_URL=$(grep '^DATABASE_URL=' .env | cut -d= -f2-) \
  npx tsx prisma/seed.ts   # requires node on the host; or run once from CI/laptop
```

Verify: `curl http://localhost:8080` (web) and `docker compose ps` shows
`db`, `api`, `web` healthy.

## 5. Post-deploy checklist

- [ ] `https://<domain>` loads and `/login` rejects wrong passwords
- [ ] `docker compose logs api | grep -i error` is clean
- [ ] Create your real owner account (sign-up) and only then remove/rotate the
      demo seed if you loaded it — the seeded accounts are for development
- [ ] Firewall blocks 5433/4000 from the public internet (compose publishes
      them; restrict with `ufw deny` or remove the port mappings)

## 6. Backups (and restore)

```bash
# nightly dump via cron
echo '0 3 * * * docker exec stockspace-db-1 pg_dump -U stockspace stockspace | gzip > /var/backups/stockspace-$(date +\%F).sql.gz' \
  | sudo tee /etc/cron.d/stockspace-backup

# restore (into a fresh container)
gunzip -c backup-2026-10-25.sql.gz | docker exec -i stockspace-db-1 psql -U stockspace stockspace
```

Copy backups off-box (rclone to object storage) — a backup that lives only on
the server is not a backup.

## 7. Updating

```bash
cd /opt/stockspace
git pull
docker compose up -d --build      # rebuilds, applies new migrations on boot
docker compose logs -f api        # watch the migrate-deploy + boot
```

## 8. Troubleshooting

| Symptom | Fix |
| --- | --- |
| `api` restarts with `P1000` (auth failed) | DB password mismatch between `.env` and compose; reset with `docker compose exec db psql -U stockspace -c "ALTER USER stockspace PASSWORD '…'"` (note: the volume keeps the *old* password — match `.env` to it or recreate the volume) |
| Login loop / 401 after sign-in | `BETTER_AUTH_URL`/`CORS_ORIGIN` don't match the public origin (scheme + host) |
| 3D scene empty | `GET /api/warehouses` empty → workspace has no warehouse; seed or create one |
| Migration failed mid-boot | `docker compose logs api`; fix, then `docker compose up -d api` again (migrate deploy is idempotent) |
