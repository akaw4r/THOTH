#!/usr/bin/env bash
# =============================================================================
# THOTH — interactive installer (Docker)
#
#   ./install.sh
#
# Asks everything needed to run the application locally via Docker Compose,
# generates the secrets, writes it all to a .env file (chmod 600) and, if you
# want, brings the stack up and creates the initial admin user.
#
# It can be run again at any time: values already present in the .env
# (especially the ENCRYPTION_KEY) are preserved by default.
# =============================================================================
set -euo pipefail

cd "$(dirname "$0")"

ENV_FILE=".env"

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
info() { printf '  \033[36m•\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*"; }
die()  { printf '  \033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

# ask VAR "question" "default"  → reads an answer with a default
ask() {
  local __var="$1" __prompt="$2" __default="${3:-}" __answer
  if [ -n "$__default" ]; then
    read -r -p "  ${__prompt} [${__default}]: " __answer
    __answer="${__answer:-$__default}"
  else
    read -r -p "  ${__prompt}: " __answer
  fi
  printf -v "$__var" '%s' "$__answer"
}

# ask_secret VAR "question"  → reads without echoing to the terminal
ask_secret() {
  local __var="$1" __prompt="$2" __answer
  read -r -s -p "  ${__prompt}: " __answer
  echo
  printf -v "$__var" '%s' "$__answer"
}

# ask_yn "question" "N"  → returns 0 for yes, 1 for no
ask_yn() {
  local __prompt="$1" __default="${2:-N}" __hint __answer
  if [ "$(printf '%s' "$__default" | tr '[:upper:]' '[:lower:]')" = "s" ]; then
    __hint="(Y/n)"
  else
    __hint="(y/N)"
  fi
  read -r -p "  ${__prompt} ${__hint}: " __answer
  __answer="$(printf '%s' "${__answer:-$__default}" | tr '[:upper:]' '[:lower:]')"
  [ "$__answer" = "s" ] || [ "$__answer" = "sim" ] || [ "$__answer" = "y" ] || [ "$__answer" = "yes" ]
}

# existing value in the .env (if any), reused across runs
env_get() {
  [ -f "$ENV_FILE" ] || return 0
  sed -n "s/^$1=//p" "$ENV_FILE" | tail -n1
}

# -----------------------------------------------------------------------------
bold ""
bold "  THOTH — installer (Docker)"
bold "  =========================="
echo

# --- Prerequisites -------------------------------------------------------------
command -v docker >/dev/null 2>&1 || die "Docker not found. Install it from https://docs.docker.com/get-docker/"
command -v openssl >/dev/null 2>&1 || die "openssl not found in PATH (required to generate the secrets)."

if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE="docker-compose"
else
  die "Docker Compose not found ('docker compose' plugin or 'docker-compose' binary)."
fi
docker info >/dev/null 2>&1 || die "The Docker daemon is not running. Start Docker and run this again."
info "Docker OK ($COMPOSE)"
echo

if [ -f "$ENV_FILE" ]; then
  warn "A $ENV_FILE already exists — current values will be used as the defaults for the questions."
  cp "$ENV_FILE" "${ENV_FILE}.bak.$(date +%Y%m%d%H%M%S)"
  info "Backup saved (${ENV_FILE}.bak.*)."
  echo
fi

# --- 1. Application address ------------------------------------------------------
bold "  1) Application address"
HTTP_PORT_DEFAULT="$(env_get HTTP_PORT)"
ask HTTP_PORT "Local HTTP port" "${HTTP_PORT_DEFAULT:-8080}"
case "$HTTP_PORT" in (*[!0-9]*|'') die "Invalid port: $HTTP_PORT";; esac
BASE_URL_DEFAULT="$(env_get BASE_URL)"
ask BASE_URL "Public URL (cookies/OIDC/WebAuthn)" "${BASE_URL_DEFAULT:-http://localhost:${HTTP_PORT}}"
echo

# --- 2. Secrets -------------------------------------------------------------------
bold "  2) Secrets (generated automatically with openssl)"
SESSION_SECRET="$(env_get SESSION_SECRET)"
ENCRYPTION_KEY="$(env_get ENCRYPTION_KEY)"
POSTGRES_PASSWORD="$(env_get POSTGRES_PASSWORD)"

if [ -n "$ENCRYPTION_KEY" ]; then
  info "Existing ENCRYPTION_KEY found — it will be REUSED (changing it would make the encrypted data unrecoverable)."
else
  ENCRYPTION_KEY="$(openssl rand -base64 32)"
  info "ENCRYPTION_KEY generated."
fi
[ -n "$SESSION_SECRET" ] || { SESSION_SECRET="$(openssl rand -base64 48)"; info "SESSION_SECRET generated."; }
[ -n "$POSTGRES_PASSWORD" ] || { POSTGRES_PASSWORD="$(openssl rand -hex 24)"; info "POSTGRES_PASSWORD generated."; }
warn "Store a copy of the ENCRYPTION_KEY in a secrets manager: without it, encrypted attachments/PDFs/TOTP are lost."
echo

# --- 3. Google sign-in (optional) -------------------------------------------------
bold "  3) Sign in with Google (OIDC)"
GOOGLE_CLIENT_ID="$(env_get GOOGLE_CLIENT_ID)"
GOOGLE_CLIENT_SECRET="$(env_get GOOGLE_CLIENT_SECRET)"
ALLOWED_EMAIL_DOMAINS="$(env_get ALLOWED_EMAIL_DOMAINS)"
ADMIN_EMAILS="$(env_get ADMIN_EMAILS)"

if ask_yn "Will you use Google sign-in?"; then
  info "You will need an OAuth Client (full guide in docs/google-oauth.md)."
  info "Redirect URI to register in Google: ${BASE_URL}/api/auth/callback/google"
  ask GOOGLE_CLIENT_ID "GOOGLE_CLIENT_ID" "$GOOGLE_CLIENT_ID"
  [ -n "$GOOGLE_CLIENT_ID" ] || die "GOOGLE_CLIENT_ID is required for Google sign-in."
  if [ -n "$GOOGLE_CLIENT_SECRET" ]; then
    if ask_yn "A GOOGLE_CLIENT_SECRET is already saved — replace it?"; then
      ask_secret GOOGLE_CLIENT_SECRET "GOOGLE_CLIENT_SECRET (hidden while typing)"
    fi
  else
    ask_secret GOOGLE_CLIENT_SECRET "GOOGLE_CLIENT_SECRET (hidden while typing)"
  fi
  [ -n "$GOOGLE_CLIENT_SECRET" ] || die "GOOGLE_CLIENT_SECRET is required for Google sign-in."
  ask ALLOWED_EMAIL_DOMAINS "Email domains allowed to sign in (comma-separated)" "${ALLOWED_EMAIL_DOMAINS:-yourcompany.com}"
  ask ADMIN_EMAILS "Emails that become admin on 1st login (comma-separated; empty = none)" "$ADMIN_EMAILS"
  info "Google Workspace group restriction (optional/advanced): configure it later in the .env (GOOGLE_ALLOWED_GROUPS...)."
else
  GOOGLE_CLIENT_ID=""
  GOOGLE_CLIENT_SECRET=""
  ALLOWED_EMAIL_DOMAINS="${ALLOWED_EMAIL_DOMAINS:-example.com}"
  info "No Google: access will be through the local admin (/auth/local route, with mandatory MFA)."
fi
echo

# --- 4. AI assistant (optional) -----------------------------------------------------
bold "  4) AI assistant (chat and report text generation)"
AI_PROVIDER="$(env_get AI_PROVIDER)"
AI_MODEL="$(env_get AI_MODEL)"
ANTHROPIC_API_KEY="$(env_get ANTHROPIC_API_KEY)"
OLLAMA_BASE_URL="$(env_get OLLAMA_BASE_URL)"

if ask_yn "Enable the AI assistant?"; then
  info "Supported providers:"
  info "  1) Anthropic (Anthropic's API — requires an API key)"
  info "  2) Ollama (local LLM — requires Ollama running on this machine or on the network)"
  ask AI_CHOICE "Which LLM provider will you use? (1/2)" "${AI_PROVIDER:+$([ "$AI_PROVIDER" = "anthropic" ] && echo 1 || echo 2)}"
  case "$AI_CHOICE" in
    1|anthropic)
      AI_PROVIDER="anthropic"
      if [ -n "$ANTHROPIC_API_KEY" ]; then
        if ask_yn "An ANTHROPIC_API_KEY is already saved — replace it?"; then
          ask_secret ANTHROPIC_API_KEY "ANTHROPIC_API_KEY (hidden while typing)"
        fi
      else
        ask_secret ANTHROPIC_API_KEY "ANTHROPIC_API_KEY (hidden while typing)"
      fi
      [ -n "$ANTHROPIC_API_KEY" ] || die "ANTHROPIC_API_KEY is required for the Anthropic provider."
      ask AI_MODEL "Model" "${AI_MODEL:-claude-opus-5}"
      ;;
    2|ollama)
      AI_PROVIDER="ollama"
      info "Inside Docker, this machine's Ollama is reachable at http://host.docker.internal:11434."
      ask OLLAMA_BASE_URL "Ollama URL" "${OLLAMA_BASE_URL:-http://host.docker.internal:11434}"
      ask AI_MODEL "Model (must be available: ollama pull <model>)" "${AI_MODEL:-llama3.1}"
      ;;
    *)
      die "Invalid option: choose 1 (Anthropic) or 2 (Ollama)."
      ;;
  esac
  [ -n "$AI_MODEL" ] || die "A model is required to enable the AI assistant."
else
  AI_PROVIDER=""
  AI_MODEL=""
  ANTHROPIC_API_KEY=""
  OLLAMA_BASE_URL=""
  info "AI assistant disabled (the application works normally without it)."
fi
echo

# --- 5. Demo data --------------------------------------------------------------------
bold "  5) Demo data"
SEED_DEMO=0
if ask_yn "Create a sample project on first boot?"; then SEED_DEMO=1; fi
echo

# --- Write the .env ---------------------------------------------------------------------
umask 177
cat > "$ENV_FILE" <<EOF
# =============================================================================
# THOTH — generated by ./install.sh on $(date '+%Y-%m-%d %H:%M:%S')
# This file contains SECRETS: keep it chmod 600 and NEVER commit it
# (it is already in .gitignore). Back up the ENCRYPTION_KEY somewhere safe.
# Run ./install.sh again to reconfigure (secrets are preserved).
# =============================================================================

# --- Application ---
BASE_URL=${BASE_URL}
HTTP_PORT=${HTTP_PORT}
NODE_ENV=development
TRUST_PROXY_HOPS=1
SESSION_TTL_HOURS=8
MIGRATE_ON_BOOT=true
SEED_DEMO=${SEED_DEMO}

# --- Secrets (generated; do NOT share) ---
SESSION_SECRET=${SESSION_SECRET}
ENCRYPTION_KEY=${ENCRYPTION_KEY}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}

# --- Database ---
POSTGRES_USER=thoth
POSTGRES_DB=thoth

# --- Google sign-in (empty = disabled; guide in docs/google-oauth.md) ---
GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
OIDC_REDIRECT_PATH=/api/auth/callback/google
ALLOWED_EMAIL_DOMAINS=${ALLOWED_EMAIL_DOMAINS}
ADMIN_EMAILS=${ADMIN_EMAILS}
DEFAULT_USER_ROLE=VIEWER

# --- Google Workspace group restriction (optional/advanced) ---
GOOGLE_ALLOWED_GROUPS=
GOOGLE_WORKSPACE_SA_JSON=
GOOGLE_WORKSPACE_ADMIN_SUBJECT=

# --- Local break-glass admin (/auth/local route, requires MFA) ---
LOCAL_ADMIN_ENABLED=true

# --- AI assistant (AI_PROVIDER: anthropic | ollama; empty = disabled) ---
AI_PROVIDER=${AI_PROVIDER}
AI_MODEL=${AI_MODEL}
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
OLLAMA_BASE_URL=${OLLAMA_BASE_URL}
EOF
umask 022
chmod 600 "$ENV_FILE"
bold "  ✓ Configuration written to ${ENV_FILE} (chmod 600)."
echo

# --- Bring the stack up ---------------------------------------------------------------
if ! ask_yn "Bring the application up now with '$COMPOSE up -d --build'?" "s"; then
  echo
  info "When you are ready:  $COMPOSE up -d --build"
  info "The application will be available at ${BASE_URL}"
  exit 0
fi

echo
$COMPOSE up -d --build
echo
info "Waiting for the API to become healthy (the first build can take a few minutes)..."
HEALTH_URL="http://localhost:${HTTP_PORT}/api/health"
for i in $(seq 1 60); do
  if command -v curl >/dev/null 2>&1; then
    curl -fsS "$HEALTH_URL" >/dev/null 2>&1 && { HEALTHY=1; break; }
  else
    $COMPOSE ps api 2>/dev/null | grep -q '(healthy)' && { HEALTHY=1; break; }
  fi
  sleep 5
done

if [ "${HEALTHY:-0}" != "1" ]; then
  warn "The API has not responded yet at ${HEALTH_URL}."
  warn "Follow along with:  $COMPOSE logs -f api"
  exit 1
fi
bold "  ✓ Application is up: ${BASE_URL}"
echo

# --- Initial admin ----------------------------------------------------------------------
if ask_yn "Create the local admin user (break-glass) now?" "s"; then
  ask ADMIN_USERNAME "Admin username" "breakglass"
  ask ADMIN_EMAIL "Admin email" "admin@${ALLOWED_EMAIL_DOMAINS%%,*}"
  echo
  $COMPOSE exec api node apps/api/dist/cli/create-admin.js --username "$ADMIN_USERNAME" --email "$ADMIN_EMAIL"
  echo
  info "Local admin login: ${BASE_URL}/auth/local (on 1st access the system forces a password change + MFA)."
fi

echo
bold "  Done! Summary:"
info "App:            ${BASE_URL}"
info "Local admin:    ${BASE_URL}/auth/local"
[ -n "$GOOGLE_CLIENT_ID" ] && info "Google login:   enabled (domains: ${ALLOWED_EMAIL_DOMAINS})"
[ -n "$AI_PROVIDER" ] && info "AI assistant:   enabled (${AI_PROVIDER} · ${AI_MODEL})"
info "Logs:           $COMPOSE logs -f"
info "Stop:           $COMPOSE down        (data stays in the volumes)"
info "Backup:         deploy/backup.sh  |  Restore: deploy/restore.sh"
warn "Don't forget: copy the ENCRYPTION_KEY from the .env to a safe place."
