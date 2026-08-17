/**
 * Idempotent seed: ensures the default design, the reference OWASP taxonomy and the
 * standardized finding template library (OWASP Web/API/LLM). Run at container
 * start (entrypoint) and via `npm run seed`. With SEED_DEMO=1, it also creates
 * a sample project.
 *
 * The template library's source of truth is FINDING_TEMPLATE_LIBRARY
 * (@thoth/shared) and it is seeded by title (natural identity), preserving
 * any template created by users.
 */
import 'reflect-metadata';
import { PrismaClient } from '@prisma/client';
import { DEFAULT_DESIGN } from '@thoth/shared/node';
import {
  DEFAULT_SECTIONS,
  FINDING_TEMPLATE_LIBRARY,
  OWASP_CATEGORIES,
  evaluateCvssVector,
} from '@thoth/shared';

const prisma = new PrismaClient();

/**
 * Keeps the default design "THOTH — Default" in sync with the code
 * (DEFAULT_DESIGN): creates it if it doesn't exist, otherwise UPDATES the
 * template fields. This is why rebuilds pick up cover/header/footer changes
 * without having to delete the design in the database. Custom designs should be
 * created as NEW designs (not by editing the default), since the default is
 * managed by the code.
 */
async function seedDesign(): Promise<void> {
  const data = {
    name: DEFAULT_DESIGN.name,
    description: DEFAULT_DESIGN.description,
    htmlTemplate: DEFAULT_DESIGN.htmlTemplate,
    css: DEFAULT_DESIGN.css,
    headerTemplate: DEFAULT_DESIGN.headerTemplate,
    footerTemplate: DEFAULT_DESIGN.footerTemplate,
    isDefault: true,
  };
  const existing = await prisma.reportDesign.findFirst({ where: { isDefault: true } });
  if (existing) {
    await prisma.reportDesign.update({ where: { id: existing.id }, data });
    console.log('[seed] default design updated (synced with the code)');
  } else {
    await prisma.reportDesign.create({ data });
    console.log('[seed] default design created');
  }
}

/** Upsert by `code` (stable natural identity) — idempotent across boots. */
async function seedOwaspCategories(): Promise<void> {
  for (const c of OWASP_CATEGORIES) {
    await prisma.owaspCategory.upsert({
      where: { code: c.code },
      create: c,
      update: { family: c.family, name: c.name, order: c.order },
    });
  }
  console.log(`[seed] ${OWASP_CATEGORIES.length} OWASP categories ensured`);
}

/**
 * Seeds the standardized finding template library. Idempotent by title:
 * updates the canonical content if the template already exists, otherwise
 * creates it. Resolves the OWASP code to the `owaspCategoryId` FK (seeded in
 * seedOwaspCategories, which runs first).
 */
async function seedFindingTemplateLibrary(): Promise<void> {
  const categories = await prisma.owaspCategory.findMany({ select: { id: true, code: true } });
  const codeToId = new Map(categories.map((c) => [c.code, c.id]));

  let created = 0;
  let updated = 0;
  for (const t of FINDING_TEMPLATE_LIBRARY) {
    const owaspCategoryId = codeToId.get(t.owaspCode) ?? null;
    if (!owaspCategoryId) {
      console.warn(
        `[seed] OWASP category not found for ${t.owaspCode} — template "${t.title}" will be left unclassified`,
      );
    }
    const data = {
      severity: t.severity,
      descriptionMd: t.descriptionMd,
      impactMd: t.impactMd,
      recommendationMd: t.recommendationMd,
      referencesMd: t.referencesMd,
      tags: t.tags,
      owaspCategoryId,
    };

    const existing = await prisma.findingTemplate.findFirst({
      where: { title: t.title },
      select: { id: true },
    });
    if (existing) {
      await prisma.findingTemplate.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      await prisma.findingTemplate.create({ data: { title: t.title, ...data } });
      created++;
    }
  }
  console.log(`[seed] template library ensured (${created} created, ${updated} updated)`);
}

async function seedDemo(): Promise<void> {
  if (process.env.SEED_DEMO !== '1' && process.env.SEED_DEMO?.toLowerCase() !== 'true') return;
  const exists = await prisma.project.findFirst({ where: { name: 'Demo Project' } });
  if (exists) return;

  const injection = await prisma.owaspCategory.findUnique({ where: { code: 'A03:2021' } });
  const cvssVector = 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H';
  const cvss = evaluateCvssVector(cvssVector);

  await prisma.project.create({
    data: {
      name: 'Demo Project',
      client: 'ACME — Internal',
      scope: 'https://app.example.com\nAPI: https://api.example.com',
      status: 'REPORTING',
      sections: {
        create: DEFAULT_SECTIONS.map((s, i) => ({
          title: s.title,
          slug: s.slug,
          order: i,
          contentMd: s.contentMd,
        })),
      },
      findings: {
        create: [
          {
            title: 'SQL Injection',
            severity: 'CRITICAL',
            cvssVector,
            cvssScore: cvss?.score ?? null,
            status: 'FINAL',
            descriptionMd:
              'The application concatenates user input directly into SQL queries, allowing an attacker to inject arbitrary commands.',
            impactMd:
              'Unauthorized data read/modification, authentication bypass and possible command execution on the database server.',
            recommendationMd:
              'Use **parameterized queries** (prepared statements) or an ORM. Validate input and apply least privilege to the database user.',
            referencesMd: '- https://owasp.org/www-community/attacks/SQL_Injection\n- CWE-89',
            affectedAssets: ['https://app.example.com/login'],
            owaspCategoryId: injection?.id ?? null,
          },
        ],
      },
    },
  });
  console.log('[seed] demo project created');
}

async function main(): Promise<void> {
  await seedDesign();
  await seedOwaspCategories();
  await seedFindingTemplateLibrary();
  await seedDemo();
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('[seed] error:', err);
  await prisma.$disconnect();
  process.exit(1);
});
