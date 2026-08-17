/// <reference lib="dom" />
// The `dom` lib above is only for typechecking the code that runs in the browser
// inside `page.evaluate` (uses `document`/HTMLElement). No runtime effect — the
// worker remains pure Node.
import { chromium, type Browser, type Page } from 'playwright';
import { PrismaClient } from '@prisma/client';
import {
  buildReportHtml,
  decryptBuffer,
  encryptBuffer,
  type ReportRenderInput,
} from '@thoth/shared/node';

/** Reuses a single Chromium instance across jobs. */
let browserPromise: Promise<Browser> | null = null;
function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  }
  return browserPromise;
}

export async function closeBrowser(): Promise<void> {
  if (browserPromise) {
    const b = await browserPromise;
    await b.close();
    browserPromise = null;
  }
}

export interface RenderDeps {
  prisma: PrismaClient;
  encryptionKey: Buffer;
}

// A4 page (mm) and PDF margins — used both in page.pdf and in the Table of
// Contents pagination calculation. Keep in sync with the page.pdf `margin` below.
const PAGE = {
  widthMm: 210,
  heightMm: 297,
  marginTopMm: 36,
  marginBottomMm: 20,
  marginLeftMm: 14,
  marginRightMm: 14,
};
const PX_PER_MM = 96 / 25.4;
const CONTENT_WIDTH_PX = Math.round(
  (PAGE.widthMm - PAGE.marginLeftMm - PAGE.marginRightMm) * PX_PER_MM,
);
const CONTENT_HEIGHT_PX = Math.round(
  (PAGE.heightMm - PAGE.marginTopMm - PAGE.marginBottomMm) * PX_PER_MM,
);

/**
 * Numbers the Table of Contents. Chromium does not number indexes on its own, so
 * we measure the document's pagination in `print` media (usable page area width)
 * and fill each `.toc-page[data-target]` with the number of the page where the
 * corresponding anchor starts.
 *
 * The template forces a page break before each top-level block (.toc,
 * .engagement, .summary, .report-section, .findings), so each block's starting
 * page is deterministic: 1 + total pages of the previous blocks.
 * Within .findings, each .finding has `page-break-inside: avoid`, simulated
 * here by sequential packing.
 */
async function fillTableOfContents(page: Page): Promise<void> {
  await page.emulateMedia({ media: 'print' });
  await page.setViewportSize({ width: CONTENT_WIDTH_PX, height: CONTENT_HEIGHT_PX });

  const pageByAnchor = await page.evaluate((H: number) => {
    const result: Record<string, number> = {};
    const blocks = Array.from(
      document.querySelectorAll<HTMLElement>(
        '.cover, .toc, .engagement, .summary, .report-section, .findings',
      ),
    );
    let nextStart = 1; // page where the next top-level block starts
    for (const block of blocks) {
      const startPage = nextStart;
      if (block.id) result[block.id] = startPage;

      let pagesUsed: number;
      if (block.classList.contains('findings')) {
        const heading = block.querySelector<HTMLElement>('h2');
        let used = heading ? heading.getBoundingClientRect().height : 0;
        pagesUsed = 1;
        for (const f of Array.from(block.querySelectorAll<HTMLElement>('.finding'))) {
          const fh = f.getBoundingClientRect().height;
          if (used > 0 && used + fh > H) {
            pagesUsed += 1;
            used = 0;
          }
          if (f.id) result[f.id] = startPage + pagesUsed - 1;
          if (fh > H) {
            const extra = Math.ceil(fh / H) - 1;
            pagesUsed += extra;
            used = fh - extra * H;
          } else {
            used += fh;
          }
        }
      } else {
        const h = block.getBoundingClientRect().height;
        pagesUsed = Math.max(1, Math.ceil(h / H));
      }
      nextStart = startPage + pagesUsed;
    }
    return result;
  }, CONTENT_HEIGHT_PX);

  await page.evaluate((map: Record<string, number>) => {
    for (const [anchor, pageNum] of Object.entries(map)) {
      document.querySelectorAll<HTMLElement>(`.toc-page[data-target="${anchor}"]`).forEach((el) => {
        el.textContent = String(pageNum);
      });
    }
  }, pageByAnchor);
}

/**
 * Renders a project's report to PDF and saves it (encrypted) in Report.pdfData.
 * Throws on failure — BullMQ takes care of the retry.
 */
export async function renderReport(
  reportId: string,
  projectId: string,
  deps: RenderDeps,
): Promise<void> {
  const { prisma, encryptionKey } = deps;

  const report = await prisma.report.findUnique({ where: { id: reportId } });
  if (!report) throw new Error(`Report ${reportId} not found`);

  await prisma.report.update({ where: { id: reportId }, data: { status: 'RENDERING' } });

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      findings: true,
      sections: { orderBy: { order: 'asc' } },
    },
  });
  if (!project) throw new Error(`Project ${projectId} not found`);

  const design = report.designId
    ? await prisma.reportDesign.findUnique({ where: { id: report.designId } })
    : await prisma.reportDesign.findFirst({ where: { isDefault: true } });
  if (!design) throw new Error('No design available to render');

  const requester = report.requestedById
    ? await prisma.user.findUnique({ where: { id: report.requestedById } })
    : null;

  // Preloads the project's attachments as data URIs (the markdown resolver is synchronous).
  const attachments = await prisma.attachment.findMany({ where: { projectId } });
  const attachmentDataUris = new Map<string, string>();
  for (const att of attachments) {
    try {
      const plain = decryptBuffer(Buffer.from(att.data), encryptionKey);
      attachmentDataUris.set(att.id, `data:${att.mimeType};base64,${plain.toString('base64')}`);
    } catch {
      // corrupted attachment — ignore (does not break the report)
    }
  }

  const input: ReportRenderInput = {
    design: { htmlTemplate: design.htmlTemplate, css: design.css },
    project: {
      name: project.name,
      client: project.client,
      scope: project.scope,
      startDate: project.startDate,
      endDate: project.endDate,
      reportDate: project.reportDate,
      techLead: project.techLead,
      status: project.status,
    },
    sections: project.sections.map((s) => ({
      title: s.title,
      contentMd: s.contentMd,
      slug: s.slug,
    })),
    findings: project.findings.map((f) => ({
      title: f.title,
      severity: f.severity,
      cvssScore: f.cvssScore,
      cvssVector: f.cvssVector,
      status: f.status,
      affectedAssets: f.affectedAssets,
      descriptionMd: f.descriptionMd,
      impactMd: f.impactMd,
      recommendationMd: f.recommendationMd,
      referencesMd: f.referencesMd,
    })),
    meta: { generatedAt: new Date(), generatedBy: requester?.email ?? 'THOTH' },
    resolveAttachment: (id) => attachmentDataUris.get(id) ?? '',
  };

  const html = buildReportHtml(input);

  const browser = await getBrowser();
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle' });
    await fillTableOfContents(page);
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: design.headerTemplate || '<span></span>',
      footerTemplate: design.footerTemplate || '<span></span>',
      // Larger margins to accommodate the green band (top) and the footer on every
      // page. Kept in sync with the PAGE constants (Table of Contents numbering).
      margin: {
        top: `${PAGE.marginTopMm}mm`,
        bottom: `${PAGE.marginBottomMm}mm`,
        left: `${PAGE.marginLeftMm}mm`,
        right: `${PAGE.marginRightMm}mm`,
      },
    });

    await prisma.report.update({
      where: { id: reportId },
      data: {
        status: 'DONE',
        pdfData: encryptBuffer(Buffer.from(pdf), encryptionKey),
        completedAt: new Date(),
        error: null,
      },
    });
  } finally {
    await context.close();
  }
}
