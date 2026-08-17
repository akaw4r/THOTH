import Handlebars from 'handlebars';
import {
  FINDING_STATUS_LABELS,
  PROJECT_STATUS_LABELS,
  SEVERITIES,
  SEVERITY_COLORS,
  SEVERITY_LABELS,
  SEVERITY_ORDER,
  type FindingStatus,
  type ProjectStatus,
  type Severity,
} from '../constants';
import { renderMarkdown, type AttachmentResolver } from './markdown';

export interface ReportFindingInput {
  title: string;
  severity: Severity;
  cvssScore: number | null;
  cvssVector: string | null;
  status: FindingStatus;
  affectedAssets: string[];
  descriptionMd: string;
  impactMd: string;
  recommendationMd: string;
  referencesMd: string;
}

export interface ReportRenderInput {
  design: { htmlTemplate: string; css: string };
  project: {
    name: string;
    client: string;
    scope: string;
    startDate: Date | string | null;
    endDate: Date | string | null;
    reportDate?: Date | string | null;
    techLead?: string;
    status: ProjectStatus;
  };
  sections: Array<{ title: string; contentMd: string; slug?: string }>;
  findings: ReportFindingInput[];
  meta: { generatedAt: Date; generatedBy: string };
  branding?: { companyName?: string; logoSvg?: string };
  resolveAttachment?: AttachmentResolver;
}

const DEFAULT_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 48" width="220" height="36" role="img" aria-label="Your Company — Offensive Security"><rect width="48" height="48" rx="10" fill="#0DA65C"/><path d="M31 15a10 10 0 1 0 0 18" stroke="#ffffff" stroke-width="5" stroke-linecap="round" fill="none"/><text x="60" y="32" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700" fill="#10231B">Your Company</text><text x="176" y="32" font-family="Arial, Helvetica, sans-serif" font-size="13" font-weight="400" fill="#5A6B62">Offensive Sec.</text></svg>`;

function formatDatePtBr(value: Date | string | null | undefined): string {
  if (!value) return '';
  const date =
    typeof value === 'string'
      ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00Z` : value)
      : value;
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', dateStyle: 'long' }).format(date);
}

function createHandlebars(): typeof Handlebars {
  const hb = Handlebars.create();
  hb.registerHelper('formatDate', (value: Date | string | null) => formatDatePtBr(value));
  hb.registerHelper('eq', (a: unknown, b: unknown) => a === b);
  hb.registerHelper('upper', (value: unknown) => String(value ?? '').toUpperCase());
  return hb;
}

/**
 * Builds the complete HTML document of the report (ready for Chromium to print).
 * All user markdown goes through sanitization; the template itself is managed
 * content (only admins edit designs).
 */
export function buildReportHtml(input: ReportRenderInput): string {
  const resolve = input.resolveAttachment;
  const mdToHtml = (src: string) => (src?.trim() ? renderMarkdown(src, resolve) : '');

  const sortedFindings = [...input.findings].sort((a, b) => {
    const bySeverity = SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity];
    if (bySeverity !== 0) return bySeverity;
    const byScore = (b.cvssScore ?? -1) - (a.cvssScore ?? -1);
    if (byScore !== 0) return byScore;
    return a.title.localeCompare(b.title, 'en-US');
  });

  const findings = sortedFindings.map((f, i) => ({
    ref: `F-${String(i + 1).padStart(2, '0')}`,
    title: f.title,
    severityKey: f.severity,
    severityLabel: SEVERITY_LABELS[f.severity],
    severityColor: SEVERITY_COLORS[f.severity],
    statusLabel: FINDING_STATUS_LABELS[f.status],
    cvssScoreLabel: f.cvssScore != null ? f.cvssScore.toFixed(1) : '',
    cvssVector: f.cvssVector ?? '',
    affectedAssets: f.affectedAssets,
    descriptionHtml: mdToHtml(f.descriptionMd),
    impactHtml: mdToHtml(f.impactMd),
    recommendationHtml: mdToHtml(f.recommendationMd),
    referencesHtml: mdToHtml(f.referencesMd),
  }));

  const countsBySeverity = SEVERITIES.map((severity) => {
    const count = findings.filter((f) => f.severityKey === severity).length;
    return {
      key: severity,
      label: SEVERITY_LABELS[severity],
      color: SEVERITY_COLORS[severity],
      count,
    };
  });
  const maxCount = Math.max(1, ...countsBySeverity.map((c) => c.count));
  const stats = {
    total: findings.length,
    counts: countsBySeverity.map((c) => ({
      ...c,
      barWidth: Math.round((c.count / maxCount) * 100),
    })),
  };

  // Closing sections (Conclusion, References) go AFTER the finding details;
  // all others, before. Identified by slug, with a fallback on the title.
  const isClosingSection = (s: { title: string; slug?: string }): boolean => {
    if (s.slug) return s.slug === 'conclusion' || s.slug === 'references';
    return /^\s*(conclus|referenc)/i.test(s.title);
  };
  const toSection = (s: { title: string; contentMd: string; slug?: string }, i: number) => ({
    title: s.title,
    html: mdToHtml(s.contentMd),
    anchorId: `sec-${s.slug ?? `idx-${i}`}`,
  });
  const sectionsBefore = input.sections
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => !isClosingSection(s))
    .map(({ s, i }) => toSection(s, i));
  const sectionsAfter = input.sections
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => isClosingSection(s))
    .map(({ s, i }) => toSection(s, i));

  // Table of contents in the order the blocks appear in the document. The page
  // number (`toc-page`) is filled in by the worker after measuring pagination —
  // Chromium does not number tables of contents on its own.
  const toc: Array<{ label: string; targetId: string; level: number }> = [
    { label: 'Engagement Details', targetId: 'sec-engagement', level: 1 },
    { label: 'Vulnerability Summary', targetId: 'sec-summary', level: 1 },
    ...sectionsBefore.map((s) => ({ label: s.title, targetId: s.anchorId, level: 1 })),
    ...(findings.length
      ? [
          { label: 'Finding Details', targetId: 'sec-findings', level: 1 },
          ...findings.map((f) => ({
            label: `${f.ref} — ${f.title}`,
            targetId: `finding-${f.ref}`,
            level: 2,
          })),
        ]
      : []),
    ...sectionsAfter.map((s) => ({ label: s.title, targetId: s.anchorId, level: 1 })),
  ];

  const view = {
    project: {
      name: input.project.name,
      client: input.project.client,
      scope: input.project.scope,
      startDate: input.project.startDate,
      endDate: input.project.endDate,
      statusLabel: PROJECT_STATUS_LABELS[input.project.status],
    },
    sectionsBefore,
    sectionsAfter,
    toc,
    findings,
    stats,
    // Cover metadata: "Date" uses the report date (or the end/start of the
    // time frame, or the generation date as fallback); "Author" uses the
    // project's tech lead (or whoever generated the report as fallback).
    cover: {
      date:
        formatDatePtBr(
          input.project.reportDate ?? input.project.endDate ?? input.project.startDate,
        ) ||
        new Intl.DateTimeFormat('en-US', {
          dateStyle: 'long',
          timeZone: 'UTC',
        }).format(input.meta.generatedAt),
      responsible: input.project.techLead?.trim() ? input.project.techLead : input.meta.generatedBy,
    },
    meta: {
      generatedAt: new Intl.DateTimeFormat('en-US', {
        dateStyle: 'long',
        timeStyle: 'short',
        timeZone: 'UTC',
      }).format(input.meta.generatedAt),
      generatedBy: input.meta.generatedBy,
    },
    branding: {
      companyName: input.branding?.companyName ?? 'Your Company',
      logoSvg: input.branding?.logoSvg ?? DEFAULT_LOGO_SVG,
    },
  };

  const hb = createHandlebars();
  const body = hb.compile(input.design.htmlTemplate, { strict: false })(view);

  // Document title — used by Chromium in the footer's `.title` class
  // (subtitle "Vulnerability Report – Client – Project").
  const docTitle = ['Vulnerability Report', input.project.client, input.project.name]
    .filter((p) => p && String(p).trim())
    .join(' – ');
  const escapeHtml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  return [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    `<title>${escapeHtml(docTitle)}</title>`,
    `<style>${input.design.css}</style>`,
    '</head>',
    `<body>${body}</body>`,
    '</html>',
  ].join('\n');
}
