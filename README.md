# THOTH

<p align="center">
  <img src="docs/thoth.svg" width="180" alt="Thoth, the ibis-headed Egyptian god of writing, holding a scribe's tablet" />
</p>

Open source pentest reporting platform. Manage engagements, track findings with CVSS v3.1 scoring, and generate polished PDF reports — self-hosted, Docker-only.

> **Why "THOTH"?** Thoth is the ancient Egyptian god of writing, knowledge and record-keeping — the ibis-headed divine scribe who documented everything. A fitting patron for a tool whose whole job is turning offensive security work into clear, well-kept reports.

## Features

- **Projects & engagements** — scope, client, status, per-project members and roles
- **Findings** — CVSS v3.1 calculator, OWASP taxonomy (Web / API / LLM), Markdown editing with preview
- **Template library** — reusable finding templates seeded with OWASP-based content
- **PDF reports** — customizable HTML/CSS designs rendered to PDF by a background worker
- **Authentication** — optional Google OIDC + local break-glass admin, with MFA (TOTP or WebAuthn passkey) — optional by default, enforceable with `MFA_REQUIRED=true`
- **AI assistant** (optional) — chat and report text generation via **Anthropic** or a local **Ollama** instance
- **Secure by default** — sensitive data encrypted at rest (AES-256-GCM), every action audited

## Screenshots

|                                                     |                                                        |
| --------------------------------------------------- | ------------------------------------------------------ |
| ![Dashboard](docs/screenshots/dashboard.png)        | ![Finding editor](docs/screenshots/finding-editor.png) |
| ![Template library](docs/screenshots/templates.png) | ![Login](docs/screenshots/login.png)                   |

## Stack

| Layer    | Technology                                       |
| -------- | ------------------------------------------------ |
| Backend  | Node.js 22 · NestJS 10 · Prisma · Zod            |
| Frontend | React 18 · Vite · Mantine · TanStack Query       |
| Data     | PostgreSQL 16 · Redis 7                          |
| PDF      | BullMQ worker + Playwright (headless Chromium)   |
| Infra    | Docker Compose · Caddy (automatic HTTPS in prod) |

## Quick Start

Requirements: **Docker + Docker Compose** (and `openssl`, present on virtually every system).

```bash
./install.sh
```

The interactive installer asks for everything the app needs:

- local port / public URL;
- **Google login** (optional) — client ID, client secret, allowed e-mail domains, admin e-mails;
- **AI assistant** (optional) — pick a provider: **Anthropic** (API key + model) or **Ollama** (instance URL + model);
- demo data.

It generates the secrets (`SESSION_SECRET`, `ENCRYPTION_KEY`, `POSTGRES_PASSWORD`), writes everything to a local `.env` with `chmod 600` (gitignored), starts the stack, waits for the health check and offers to create the initial admin.

Re-running `./install.sh` reconfigures **without losing secrets** — the `ENCRYPTION_KEY` is never regenerated (changing it would make encrypted data unrecoverable).

> **Back up your `ENCRYPTION_KEY`** (stored in `.env`) in a secrets manager.

### Manual setup

```bash
cp .env.example .env           # non-sensitive configuration
source deploy/gen-secrets.sh   # generates and exports secrets in the current shell
export GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=...   # optional (Google login)
docker compose up --build
```

If a required secret is missing, compose **fails immediately** with a clear message — no insecure value is silently assumed.

- App: <http://localhost:8080>
- Prisma migrations and the seed (default design + templates) run automatically on API start.

## First Login

### Local admin (break-glass)

Without Google configured (or if it is down), access goes through the local admin — the installer offers to create it; manually:

```bash
docker compose exec api node apps/api/dist/cli/create-admin.js --username breakglass --email you@example.com
# the password comes from LOCAL_ADMIN_INITIAL_PASSWORD (if exported) or is generated and shown once
```

Open the **unlisted** route `http://localhost:8080/auth/local`. On first access the system **forces a password change** and offers **MFA enrollment** (TOTP via QR code or WebAuthn passkey) — skippable by default, or mandatory when `MFA_REQUIRED=true`.

### Google login (optional)

Step-by-step guide in [docs/google-oauth.md](docs/google-oauth.md). Summary: the exact redirect URI is `${BASE_URL}/api/auth/callback/google`, the consent screen should be **Internal** (Workspace), scopes are `openid email profile`. `ALLOWED_EMAIL_DOMAINS` restricts who can sign in; `ADMIN_EMAILS` defines who becomes admin on first login.

## Usage

1. **Create a project** — comes with default report sections and the creator as _manager_.
2. **Add findings** — manually or from a template. The CVSS vector computes score/severity automatically.
3. **Edit report sections** in Markdown.
4. **Generate the PDF** — pick a design (the default ships with placeholder branding; customize it under _Settings → Designs_). The worker renders in the background. JSON export is also available.
5. **Members & per-project roles** (manager / editor / viewer) — full isolation between projects.

## AI Assistant (optional)

The chat and report text generation are disabled unless a provider is configured:

| Provider    | Configuration                                           |
| ----------- | ------------------------------------------------------- |
| `anthropic` | `ANTHROPIC_API_KEY` + `AI_MODEL` (e.g. `claude-opus-5`) |
| `ollama`    | `OLLAMA_BASE_URL` + `AI_MODEL` (e.g. `llama3.1`)        |

Inside Docker, an Ollama instance running on the host is reachable at `http://host.docker.internal:11434` (the compose default).

## Production (domain + HTTPS)

The project is designed to run **locally via Docker**. To expose it with your own domain and automatic TLS (Let's Encrypt via Caddy):

```bash
# in .env: BASE_URL=https://YOUR-DOMAIN, THOTH_DOMAIN=YOUR-DOMAIN, ACME_EMAIL=...
docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml up -d --build
```

Cookies become `Secure` automatically because `BASE_URL` is `https://`.

> CI/CD, Kubernetes or any other infrastructure integration is up to the adopter — the `Dockerfile`s under `apps/{api,worker,web}` are the starting point.

## Backup & Restore

```bash
./deploy/backup.sh                  # writes backups/thoth-db-<timestamp>.sql.gz
./deploy/restore.sh backups/....gz  # restores (asks for confirmation)
```

Attachments, PDFs and MFA secrets are stored **encrypted** in Postgres (AES-256-GCM), so a database dump covers everything. **Keep the `ENCRYPTION_KEY`** — without it, encrypted fields are unrecoverable.

## Configuration

All variables are documented in [.env.example](.env.example). The main ones:

| Variable                                    | Description                                                             |
| ------------------------------------------- | ----------------------------------------------------------------------- |
| `BASE_URL`                                  | Public URL (cookies, OIDC redirect, WebAuthn rpID)                      |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth client credentials (empty = Google login disabled)                |
| `ALLOWED_EMAIL_DOMAINS`                     | E-mail domains accepted on Google login                                 |
| `ADMIN_EMAILS`                              | E-mails that become admin on first login                                |
| `LOCAL_ADMIN_ENABLED`                       | Toggles the local admin (the API refuses to start with no login method) |
| `MFA_REQUIRED`                              | `false` (default): MFA enrollment is skippable; `true`: enforced        |
| `SESSION_SECRET`                            | Session secret (Redis)                                                  |
| `ENCRYPTION_KEY`                            | AES-256 key (32 bytes; base64 or hex)                                   |
| `AI_PROVIDER` / `AI_MODEL`                  | AI assistant: `anthropic` or `ollama` + model (empty = disabled)        |
| `ANTHROPIC_API_KEY` / `OLLAMA_BASE_URL`     | Provider credential (Anthropic) or instance URL (Ollama)                |
| `DATABASE_URL` / `REDIS_URL`                | Connections (compose defaults just work)                                |

## Development

```bash
npm install
npm run build:shared
# start Postgres and Redis (e.g. docker compose up db redis)
export DATABASE_URL=postgresql://thoth:thoth@localhost:5432/thoth REDIS_URL=redis://localhost:6379
npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
npm run dev -w @thoth/api      # API on :3000
npm run dev -w @thoth/web      # Vite on :5173 (proxies /api → :3000)
npm run dev -w @thoth/worker   # worker
```

Monorepo layout (npm workspaces):

```
apps/api         NestJS API (auth, domain, REST)
apps/worker      BullMQ + Playwright worker (PDF)
apps/web         React SPA
packages/shared  Types, zod schemas, CVSS, report rendering
e2e              Playwright tests (auth)
deploy           Caddy, production compose, backup/restore
docs             Guides (Google OAuth, etc.)
```

## Testing

```bash
npm test                 # unit (shared + api + web)
npm run test:e2e         # API e2e (needs Postgres + Redis)
npm run lint             # ESLint
npm run format:check     # Prettier
```

Playwright e2e (auth): with the stack running, `npm --prefix e2e run install-browsers && npm --prefix e2e test`.

## License

Distributed under the [MIT](LICENSE) license.
