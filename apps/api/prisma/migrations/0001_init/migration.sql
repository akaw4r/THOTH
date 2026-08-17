-- THOTH — initial migration
-- Enums (the value order in Severity defines sorting: CRITICAL first)

CREATE TYPE "Role" AS ENUM ('ADMIN', 'AUTHOR', 'VIEWER');
CREATE TYPE "ProjectRole" AS ENUM ('MANAGER', 'EDITOR', 'VIEWER');
CREATE TYPE "ProjectStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'REPORTING', 'COMPLETED', 'ARCHIVED');
CREATE TYPE "Severity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO');
CREATE TYPE "FindingStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'FINAL');
CREATE TYPE "ReportStatus" AS ENUM ('QUEUED', 'RENDERING', 'DONE', 'FAILED');

-- User
CREATE TABLE "User" (
  "id" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "username" TEXT,
  "role" "Role" NOT NULL DEFAULT 'VIEWER',
  "isLocalAdmin" BOOLEAN NOT NULL DEFAULT false,
  "passwordHash" TEXT,
  "totpSecretEnc" TEXT,
  "mfaEnrolled" BOOLEAN NOT NULL DEFAULT false,
  "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
  "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
  "lockedUntil" TIMESTAMP(3),
  "lastLoginAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- WebAuthnCredential
CREATE TABLE "WebAuthnCredential" (
  "id" TEXT NOT NULL,
  "userId" UUID NOT NULL,
  "publicKey" BYTEA NOT NULL,
  "counter" BIGINT NOT NULL DEFAULT 0,
  "transports" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "name" TEXT NOT NULL DEFAULT 'Passkey',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt" TIMESTAMP(3),
  CONSTRAINT "WebAuthnCredential_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WebAuthnCredential_userId_idx" ON "WebAuthnCredential"("userId");

-- Project
CREATE TABLE "Project" (
  "id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "client" TEXT NOT NULL DEFAULT '',
  "scope" TEXT NOT NULL DEFAULT '',
  "startDate" DATE,
  "endDate" DATE,
  "status" "ProjectStatus" NOT NULL DEFAULT 'PLANNED',
  "createdById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- ProjectMember
CREATE TABLE "ProjectMember" (
  "projectId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "role" "ProjectRole" NOT NULL DEFAULT 'VIEWER',
  "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("projectId", "userId")
);
CREATE INDEX "ProjectMember_userId_idx" ON "ProjectMember"("userId");

-- FindingTemplate
CREATE TABLE "FindingTemplate" (
  "id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "severity" "Severity" NOT NULL DEFAULT 'INFO',
  "cvssVector" TEXT,
  "descriptionMd" TEXT NOT NULL DEFAULT '',
  "impactMd" TEXT NOT NULL DEFAULT '',
  "recommendationMd" TEXT NOT NULL DEFAULT '',
  "referencesMd" TEXT NOT NULL DEFAULT '',
  "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "createdById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FindingTemplate_pkey" PRIMARY KEY ("id")
);

-- Finding
CREATE TABLE "Finding" (
  "id" UUID NOT NULL,
  "projectId" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "severity" "Severity" NOT NULL DEFAULT 'INFO',
  "cvssVector" TEXT,
  "cvssScore" DOUBLE PRECISION,
  "status" "FindingStatus" NOT NULL DEFAULT 'DRAFT',
  "descriptionMd" TEXT NOT NULL DEFAULT '',
  "impactMd" TEXT NOT NULL DEFAULT '',
  "recommendationMd" TEXT NOT NULL DEFAULT '',
  "referencesMd" TEXT NOT NULL DEFAULT '',
  "affectedAssets" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "templateId" UUID,
  "createdById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Finding_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Finding_projectId_idx" ON "Finding"("projectId");

-- FindingRevision
CREATE TABLE "FindingRevision" (
  "id" UUID NOT NULL,
  "findingId" UUID NOT NULL,
  "snapshot" JSONB NOT NULL,
  "editedById" UUID,
  "editedByName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FindingRevision_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "FindingRevision_findingId_idx" ON "FindingRevision"("findingId");

-- ReportSection
CREATE TABLE "ReportSection" (
  "id" UUID NOT NULL,
  "projectId" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  "contentMd" TEXT NOT NULL DEFAULT '',
  "updatedById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReportSection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ReportSection_projectId_slug_key" ON "ReportSection"("projectId", "slug");
CREATE INDEX "ReportSection_projectId_idx" ON "ReportSection"("projectId");

-- SectionRevision
CREATE TABLE "SectionRevision" (
  "id" UUID NOT NULL,
  "sectionId" UUID NOT NULL,
  "snapshot" JSONB NOT NULL,
  "editedById" UUID,
  "editedByName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SectionRevision_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SectionRevision_sectionId_idx" ON "SectionRevision"("sectionId");

-- ReportDesign
CREATE TABLE "ReportDesign" (
  "id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "htmlTemplate" TEXT NOT NULL,
  "css" TEXT NOT NULL DEFAULT '',
  "headerTemplate" TEXT NOT NULL DEFAULT '',
  "footerTemplate" TEXT NOT NULL DEFAULT '',
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReportDesign_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ReportDesign_name_key" ON "ReportDesign"("name");

-- Report
CREATE TABLE "Report" (
  "id" UUID NOT NULL,
  "projectId" UUID NOT NULL,
  "designId" UUID,
  "requestedById" UUID,
  "status" "ReportStatus" NOT NULL DEFAULT 'QUEUED',
  "filename" TEXT NOT NULL,
  "error" TEXT,
  "pdfData" BYTEA,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Report_projectId_idx" ON "Report"("projectId");

-- Attachment
CREATE TABLE "Attachment" (
  "id" UUID NOT NULL,
  "projectId" UUID NOT NULL,
  "findingId" UUID,
  "filename" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "data" BYTEA NOT NULL,
  "uploadedById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Attachment_projectId_idx" ON "Attachment"("projectId");
CREATE INDEX "Attachment_findingId_idx" ON "Attachment"("findingId");

-- AuditLog (append-only)
CREATE TABLE "AuditLog" (
  "id" BIGSERIAL NOT NULL,
  "actorId" TEXT,
  "actorEmail" TEXT,
  "action" TEXT NOT NULL,
  "entityType" TEXT,
  "entityId" TEXT,
  "ip" TEXT,
  "userAgent" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX "AuditLog_actorEmail_idx" ON "AuditLog"("actorEmail");

-- Foreign keys
ALTER TABLE "WebAuthnCredential" ADD CONSTRAINT "WebAuthnCredential_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FindingTemplate" ADD CONSTRAINT "FindingTemplate_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "FindingTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FindingRevision" ADD CONSTRAINT "FindingRevision_findingId_fkey"
  FOREIGN KEY ("findingId") REFERENCES "Finding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReportSection" ADD CONSTRAINT "ReportSection_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SectionRevision" ADD CONSTRAINT "SectionRevision_sectionId_fkey"
  FOREIGN KEY ("sectionId") REFERENCES "ReportSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Report" ADD CONSTRAINT "Report_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Report" ADD CONSTRAINT "Report_designId_fkey"
  FOREIGN KEY ("designId") REFERENCES "ReportDesign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Report" ADD CONSTRAINT "Report_requestedById_fkey"
  FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_findingId_fkey"
  FOREIGN KEY ("findingId") REFERENCES "Finding"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
