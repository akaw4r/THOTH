#!/usr/bin/env bash
# Generates and EXPORTS the THOTH secrets in the current shell — nothing is written to disk.
#
#   source deploy/gen-secrets.sh
#
# Idempotent within the session: if a secret is already exported, it is kept.
# To reuse across sessions (ESSENTIAL for the ENCRYPTION_KEY), save the values
# printed below in your secrets manager and export them again in the next
# shell — if the ENCRYPTION_KEY changes, encrypted data (TOTP, attachments,
# PDFs) becomes unrecoverable.

if ! command -v openssl >/dev/null 2>&1; then
  echo "gen-secrets: 'openssl' not found in PATH." >&2
  return 1 2>/dev/null || exit 1
fi

# ${VAR:=...} only generates if the variable is not already set (idempotent).
: "${SESSION_SECRET:=$(openssl rand -base64 48)}"
: "${ENCRYPTION_KEY:=$(openssl rand -base64 32)}"
: "${POSTGRES_PASSWORD:=$(openssl rand -hex 24)}"
export SESSION_SECRET ENCRYPTION_KEY POSTGRES_PASSWORD

{
  echo "THOTH: secrets exported in the current shell."
  echo "  SESSION_SECRET=${SESSION_SECRET}"
  echo "  ENCRYPTION_KEY=${ENCRYPTION_KEY}   <-- SAVE this and ALWAYS reuse the same one"
  echo "  POSTGRES_PASSWORD=${POSTGRES_PASSWORD}"
  echo
  echo "For Google sign-in, also export (values from your OAuth Client):"
  echo "  export GOOGLE_CLIENT_ID=...   GOOGLE_CLIENT_SECRET=..."
  echo "Optional (otherwise create-admin generates an initial password):"
  echo "  export LOCAL_ADMIN_INITIAL_PASSWORD=..."
} >&2
