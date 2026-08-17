-- Report cover metadata on the project (optional fields).
ALTER TABLE "Project"
  ADD COLUMN "reportDate" DATE,
  ADD COLUMN "techLead"   TEXT NOT NULL DEFAULT '';
