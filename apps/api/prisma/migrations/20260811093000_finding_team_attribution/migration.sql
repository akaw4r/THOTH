-- Organizational attribution of the assessed system on the finding (optional fields).
ALTER TABLE "Finding"
  ADD COLUMN "head"     TEXT NOT NULL DEFAULT '',
  ADD COLUMN "tribe"    TEXT NOT NULL DEFAULT '',
  ADD COLUMN "squad"    TEXT NOT NULL DEFAULT '',
  ADD COLUMN "techLead" TEXT NOT NULL DEFAULT '';
