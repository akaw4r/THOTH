import type {
  FindingStatus,
  OwaspFamily,
  ProjectRole,
  ProjectStatus,
  ReportStatus,
  Role,
  Severity,
} from './constants';

/** User returned by /api/auth/me and admin endpoints. */
export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  isLocalAdmin: boolean;
  mfaEnrolled: boolean;
}

export interface MeResponse {
  user: SessionUser | null;
  csrfToken: string;
  localAdminEnabled: boolean;
}

export type LocalLoginStep =
  'mfa_required' | 'mfa_setup_required' | 'password_change_required' | 'authenticated';

export interface LocalLoginResponse {
  step: LocalLoginStep;
  methods?: Array<'totp' | 'webauthn'>;
}

export interface UserDto extends SessionUser {
  createdAt: string;
  lastLoginAt: string | null;
}

export interface ProjectMemberDto {
  userId: string;
  role: ProjectRole;
  user: { id: string; email: string; name: string };
}

export interface ProjectDto {
  id: string;
  name: string;
  client: string;
  scope: string;
  startDate: string | null;
  endDate: string | null;
  reportDate: string | null;
  techLead: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; name: string; email: string } | null;
  members?: ProjectMemberDto[];
  myRole?: ProjectRole | null;
  findingCounts?: Partial<Record<Severity, number>>;
}

/** Summarized OWASP category, embedded in templates and findings. */
export interface OwaspCategoryDto {
  id: string;
  family: OwaspFamily;
  code: string;
  name: string;
  order: number;
}

export interface FindingDto {
  id: string;
  projectId: string;
  title: string;
  severity: Severity;
  cvssVector: string | null;
  cvssScore: number | null;
  status: FindingStatus;
  descriptionMd: string;
  impactMd: string;
  recommendationMd: string;
  referencesMd: string;
  affectedAssets: string[];
  head: string;
  tribe: string;
  squad: string;
  techLead: string;
  owaspCategoryId: string | null;
  owaspCategory: OwaspCategoryDto | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: { id: string; name: string } | null;
}

export interface FindingTemplateDto {
  id: string;
  title: string;
  severity: Severity;
  cvssVector: string | null;
  descriptionMd: string;
  impactMd: string;
  recommendationMd: string;
  referencesMd: string;
  tags: string[];
  owaspCategoryId: string | null;
  owaspCategory: OwaspCategoryDto | null;
  createdAt: string;
  updatedAt: string;
}

export interface SectionDto {
  id: string;
  projectId: string;
  title: string;
  slug: string;
  order: number;
  contentMd: string;
  updatedAt: string;
}

export interface DesignDto {
  id: string;
  name: string;
  description: string;
  htmlTemplate: string;
  css: string;
  headerTemplate: string;
  footerTemplate: string;
  isDefault: boolean;
  updatedAt: string;
}

export interface ReportDto {
  id: string;
  projectId: string;
  status: ReportStatus;
  filename: string;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
  requestedBy?: { id: string; name: string } | null;
  design?: { id: string; name: string } | null;
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

/**
 * Aggregated dashboard metrics, always restricted to the projects visible to
 * the user and to the applied filters. Fields computable with the current
 * model: there is no remediation/SLA/re-test cycle in the schema, so those
 * metrics stay out until the data exists.
 */
export interface DashboardMetrics {
  totals: { projects: number; findings: number; assets: number };
  /** Score 0–100 (100 = no risk) + A–F grade, derived from the severities. */
  risk: { score: number; grade: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' };
  severityCounts: Record<Severity, number>;
  /** Editorial status of the findings (Draft / In Review / Final). */
  statusCounts: Record<FindingStatus, number>;
  /** Most recurrent OWASP categories. */
  topOwasp: Array<{ code: string; name: string; family: OwaspFamily; count: number }>;
  /** Assets with the highest concentration of severe findings (crown jewels). */
  topAssets: Array<{ asset: string; total: number; criticalHigh: number }>;
  /** Distribution by OWASP family (proxy for Web/API/LLM scope). */
  familyCounts: Record<OwaspFamily, number>;
  /** Pentest pipeline: projects by status. */
  projectPipeline: Record<ProjectStatus, number>;
  /** New findings per month (last 12 months), total and critical+high. */
  trend: Array<{ month: string; total: number; criticalHigh: number }>;
  /** Latest completed PDF reports, with download link. */
  recentReports: Array<{
    id: string;
    projectId: string;
    projectName: string;
    filename: string;
    createdAt: string;
  }>;
}

export interface AttachmentDto {
  id: string;
  projectId: string;
  findingId: string | null;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

export interface AuditLogDto {
  id: string;
  action: string;
  actorEmail: string | null;
  entityType: string | null;
  entityId: string | null;
  ip: string | null;
  userAgent: string | null;
  metadata: unknown;
  createdAt: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface RevisionDto {
  id: string;
  editedBy: { id: string; name: string } | null;
  createdAt: string;
  snapshot: Record<string, unknown>;
}
