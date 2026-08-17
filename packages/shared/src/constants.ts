export const ROLES = ['ADMIN', 'AUTHOR', 'VIEWER'] as const;
export type Role = (typeof ROLES)[number];

export const PROJECT_ROLES = ['MANAGER', 'EDITOR', 'VIEWER'] as const;
export type ProjectRole = (typeof PROJECT_ROLES)[number];

/** Hierarchy: a higher role encompasses the lower ones. */
export const PROJECT_ROLE_LEVEL: Record<ProjectRole, number> = {
  MANAGER: 3,
  EDITOR: 2,
  VIEWER: 1,
};

export const PROJECT_STATUSES = [
  'PLANNED',
  'IN_PROGRESS',
  'REPORTING',
  'COMPLETED',
  'ARCHIVED',
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  PLANNED: 'Planned',
  IN_PROGRESS: 'In Progress',
  REPORTING: 'Reporting',
  COMPLETED: 'Completed',
  ARCHIVED: 'Archived',
};

export const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'] as const;
export type Severity = (typeof SEVERITIES)[number];

export const SEVERITY_LABELS: Record<Severity, string> = {
  CRITICAL: 'Critical',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
  INFO: 'Informational',
};

export const SEVERITY_COLORS: Record<Severity, string> = {
  CRITICAL: '#7f1d1d',
  HIGH: '#dc2626',
  MEDIUM: '#f59e0b',
  LOW: '#eab308',
  INFO: '#3b82f6',
};

export const SEVERITY_ORDER: Record<Severity, number> = {
  CRITICAL: 5,
  HIGH: 4,
  MEDIUM: 3,
  LOW: 2,
  INFO: 1,
};

export const FINDING_STATUSES = ['DRAFT', 'IN_REVIEW', 'FINAL'] as const;
export type FindingStatus = (typeof FINDING_STATUSES)[number];

export const FINDING_STATUS_LABELS: Record<FindingStatus, string> = {
  DRAFT: 'Draft',
  IN_REVIEW: 'In Review',
  FINAL: 'Final',
};

export const REPORT_STATUSES = ['QUEUED', 'RENDERING', 'DONE', 'FAILED'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

// ---------------------------------------------------------------------------
// OWASP — reference taxonomy (seeded into OwaspCategory)
// ---------------------------------------------------------------------------

export const OWASP_FAMILIES = ['WEB', 'API', 'LLM'] as const;
export type OwaspFamily = (typeof OWASP_FAMILIES)[number];

export const OWASP_FAMILY_LABELS: Record<OwaspFamily, string> = {
  WEB: 'OWASP Top 10 (Web) 2021',
  API: 'OWASP API Security Top 10 (2023)',
  LLM: 'OWASP Top 10 for LLM Applications',
};

/**
 * Canonical items for each family, in the official order. `code` is the stable
 * key used as the natural (unique) identity — seeding upserts by `code`.
 */
export const OWASP_CATEGORIES: ReadonlyArray<{
  family: OwaspFamily;
  code: string;
  name: string;
  order: number;
}> = [
  // OWASP Top 10 Web — 2021
  { family: 'WEB', code: 'A01:2021', name: 'Broken Access Control', order: 1 },
  { family: 'WEB', code: 'A02:2021', name: 'Cryptographic Failures', order: 2 },
  { family: 'WEB', code: 'A03:2021', name: 'Injection', order: 3 },
  { family: 'WEB', code: 'A04:2021', name: 'Insecure Design', order: 4 },
  { family: 'WEB', code: 'A05:2021', name: 'Security Misconfiguration', order: 5 },
  { family: 'WEB', code: 'A06:2021', name: 'Vulnerable and Outdated Components', order: 6 },
  { family: 'WEB', code: 'A07:2021', name: 'Identification and Authentication Failures', order: 7 },
  { family: 'WEB', code: 'A08:2021', name: 'Software and Data Integrity Failures', order: 8 },
  { family: 'WEB', code: 'A09:2021', name: 'Security Logging and Monitoring Failures', order: 9 },
  { family: 'WEB', code: 'A10:2021', name: 'Server-Side Request Forgery (SSRF)', order: 10 },
  // OWASP API Security Top 10 — 2023
  { family: 'API', code: 'API1:2023', name: 'Broken Object Level Authorization', order: 1 },
  { family: 'API', code: 'API2:2023', name: 'Broken Authentication', order: 2 },
  {
    family: 'API',
    code: 'API3:2023',
    name: 'Broken Object Property Level Authorization',
    order: 3,
  },
  { family: 'API', code: 'API4:2023', name: 'Unrestricted Resource Consumption', order: 4 },
  { family: 'API', code: 'API5:2023', name: 'Broken Function Level Authorization', order: 5 },
  {
    family: 'API',
    code: 'API6:2023',
    name: 'Unrestricted Access to Sensitive Business Flows',
    order: 6,
  },
  { family: 'API', code: 'API7:2023', name: 'Server-Side Request Forgery', order: 7 },
  { family: 'API', code: 'API8:2023', name: 'Security Misconfiguration', order: 8 },
  { family: 'API', code: 'API9:2023', name: 'Improper Inventory Management', order: 9 },
  { family: 'API', code: 'API10:2023', name: 'Unsafe Consumption of APIs', order: 10 },
  // OWASP Top 10 for LLM Applications
  { family: 'LLM', code: 'LLM01', name: 'Prompt Injection', order: 1 },
  { family: 'LLM', code: 'LLM02', name: 'Sensitive Information Disclosure', order: 2 },
  { family: 'LLM', code: 'LLM03', name: 'Supply Chain Vulnerabilities', order: 3 },
  { family: 'LLM', code: 'LLM04', name: 'Data and Model Poisoning', order: 4 },
  { family: 'LLM', code: 'LLM05', name: 'Improper Output Handling', order: 5 },
  { family: 'LLM', code: 'LLM06', name: 'Excessive Agency', order: 6 },
  { family: 'LLM', code: 'LLM07', name: 'System Prompt Leakage', order: 7 },
  { family: 'LLM', code: 'LLM08', name: 'Vector and Embedding Weaknesses', order: 8 },
  { family: 'LLM', code: 'LLM09', name: 'Misinformation', order: 9 },
  { family: 'LLM', code: 'LLM10', name: 'Unbounded Consumption', order: 10 },
];

// ---------------------------------------------------------------------------
// Default report methodology
// ---------------------------------------------------------------------------

/**
 * Markdown list of the categories of an OWASP family, derived from
 * OWASP_CATEGORIES — so the methodology never drifts out of sync with the
 * taxonomy (no category is forgotten when items are added/removed).
 */
function owaspChecklistMd(family: OwaspFamily): string {
  return OWASP_CATEGORIES.filter((c) => c.family === family)
    .sort((a, b) => a.order - b.order)
    .map((c) => `- \`${c.code}\` — ${c.name}`)
    .join('\n');
}

/**
 * Default methodology, applied to every report. Covers the three OWASP
 * taxonomies (Web/API/LLM) in full and references the OWASP ASVS as the
 * verification standard. The list content is generated from OWASP_CATEGORIES.
 */
export const METHODOLOGY_MD = `## Approach

The audit follows a **hybrid** approach — **manual** testing combined with **automated scanning** — grounded in the OWASP frameworks and using the **OWASP ASVS** as the verification standard.

## Reference standards

- **OWASP Top 10 (Web) 2021** — critical vulnerabilities in web applications, across the browser ↔ server flow.
- **OWASP API Security Top 10 (2023)** — risks specific to API-based architectures.
- **OWASP Top 10 for LLM Applications** — risks in applications that integrate language models.
- **OWASP ASVS (Application Security Verification Standard)** — used as the verification standard; the target level (L1, L2, or L3) is set by the criticality of the asset under assessment.
- **OWASP WSTG** and **PTES** — test execution guides.

## Test phases

1. **Reconnaissance** — mapping of the attack surface (hosts, routes, APIs, integrations, and technologies).
2. **Enumeration and analysis** — authentication, authorization, business flows, and data entry points.
3. **Controlled exploitation** — hands-on validation of the vulnerabilities, without impacting service availability.
4. **Post-exploitation** — assessment of real-world impact, reach of the exposed data, and potential for lateral movement.
5. **Documentation** — evidence recording, severity classification (CVSS), and remediation recommendations.

## Coverage by taxonomy

All categories below are considered during the analysis. Every finding is mapped to at least one of them.

### ${OWASP_FAMILY_LABELS.WEB}

${owaspChecklistMd('WEB')}

### ${OWASP_FAMILY_LABELS.API}

${owaspChecklistMd('API')}

### ${OWASP_FAMILY_LABELS.LLM}

${owaspChecklistMd('LLM')}

## References

- OWASP ASVS: https://owasp.org/www-project-application-security-verification-standard/
- OWASP Top 10 (Web): https://owasp.org/Top10/
- OWASP API Security Top 10: https://owasp.org/API-Security/
- OWASP Top 10 for LLM Applications: https://genai.owasp.org/llm-top-10/
- OWASP WSTG: https://owasp.org/www-project-web-security-testing-guide/
`;

/** Sections created automatically in every new project. */
export const DEFAULT_SECTIONS: ReadonlyArray<{ title: string; slug: string; contentMd: string }> = [
  {
    title: 'Executive Summary',
    slug: 'executive-summary',
    contentMd:
      'Describe here, in executive language, the objective of the test, the time frame, the main risks identified, and the overall security assessment.',
  },
  {
    title: 'Scope',
    slug: 'scope',
    contentMd: 'List the systems, applications, networks, and credentials that were in scope.',
  },
  {
    title: 'Methodology',
    slug: 'methodology',
    contentMd: METHODOLOGY_MD,
  },
  {
    title: 'Conclusion',
    slug: 'conclusion',
    contentMd: 'Final summary, next steps, and general recommendations.',
  },
];

/** Name of the BullMQ queue for PDF rendering. */
export const REPORT_QUEUE = 'report-render';

/** Prefix used in markdown to reference attachments: ![desc](attachment:<id>) */
export const ATTACHMENT_URI_PREFIX = 'attachment:';

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MiB

export const ALLOWED_UPLOAD_MIME = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
] as const;
