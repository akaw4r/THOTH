-- CreateEnum
CREATE TYPE "OwaspFamily" AS ENUM ('WEB', 'API');

-- AlterTable
ALTER TABLE "Finding" ADD COLUMN     "owaspCategoryId" UUID,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "FindingTemplate" ADD COLUMN     "owaspCategoryId" UUID,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Project" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ReportDesign" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ReportSection" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "OwaspCategory" (
    "id" UUID NOT NULL,
    "family" "OwaspFamily" NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OwaspCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OwaspCategory_code_key" ON "OwaspCategory"("code");

-- CreateIndex
CREATE INDEX "OwaspCategory_family_order_idx" ON "OwaspCategory"("family", "order");

-- CreateIndex
CREATE INDEX "Finding_owaspCategoryId_idx" ON "Finding"("owaspCategoryId");

-- CreateIndex
CREATE INDEX "FindingTemplate_owaspCategoryId_idx" ON "FindingTemplate"("owaspCategoryId");

-- AddForeignKey
ALTER TABLE "FindingTemplate" ADD CONSTRAINT "FindingTemplate_owaspCategoryId_fkey" FOREIGN KEY ("owaspCategoryId") REFERENCES "OwaspCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_owaspCategoryId_fkey" FOREIGN KEY ("owaspCategoryId") REFERENCES "OwaspCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Data migration: removes the current finding templates (product decision).
-- The catalog is now built by users, classified by OwaspCategory.
-- Findings derived from a template use FK ON DELETE SET NULL, so they only lose
-- the link (templateId → NULL); no finding is deleted.
DELETE FROM "FindingTemplate";
