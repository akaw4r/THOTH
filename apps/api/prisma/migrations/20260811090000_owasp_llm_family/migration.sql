-- Adds the LLM family to the OWASP taxonomy (OWASP Top 10 for LLM Applications).
-- The new value is populated in OwaspCategory by the idempotent seed (not here),
-- so no rows are inserted in this migration.
ALTER TYPE "OwaspFamily" ADD VALUE IF NOT EXISTS 'LLM';
