import { z } from 'zod';
import { FINDING_STATUSES, PROJECT_ROLES, PROJECT_STATUSES, ROLES, SEVERITIES } from './constants';
import { parseCvssVector } from './cvss';

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const localLoginSchema = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(1).max(512),
});

export const totpCodeSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'TOTP code must be 6 digits'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().max(512).optional(),
  newPassword: z.string().min(12, 'Password must be at least 12 characters').max(512),
});

export const webauthnNameSchema = z.object({
  name: z.string().min(1).max(100).default('Passkey'),
});

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export const updateUserRoleSchema = z.object({
  role: z.enum(ROLES),
});

// Adds/promotes a user by email with a global role (including ADMIN). Pre-authorizes
// users who have not logged in yet — the role applies on the first Google login
// (matched by email).
export const upsertUserByEmailSchema = z.object({
  email: z.string().email().max(320),
  role: z.enum(ROLES),
});

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

export const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  client: z.string().max(200).default(''),
  scope: z.string().max(20000).default(''),
  startDate: isoDate.nullish(),
  endDate: isoDate.nullish(),
  reportDate: isoDate.nullish(),
  techLead: z.string().max(200).default(''),
  status: z.enum(PROJECT_STATUSES).default('PLANNED'),
});

export const updateProjectSchema = createProjectSchema.partial();

// Member by userId (existing user) OR by email (pre-authorizes users who have
// not logged in yet — the membership activates on the first Google login,
// matched by email).
export const upsertMemberSchema = z
  .object({
    userId: z.string().uuid().optional(),
    email: z.string().email().max(320).optional(),
    role: z.enum(PROJECT_ROLES),
  })
  .refine((v) => Boolean(v.userId) !== Boolean(v.email), {
    message: 'Provide exactly one of: userId or email.',
  });

// Batch access grant (admin): one email, one role, one or more projects.
export const grantAccessSchema = z.object({
  email: z.string().email().max(320),
  role: z.enum(PROJECT_ROLES),
  projectIds: z.array(z.string().uuid()).min(1).max(500),
});

// ---------------------------------------------------------------------------
// Findings
// ---------------------------------------------------------------------------

const cvssVector = z
  .string()
  .max(120)
  .refine((v) => parseCvssVector(v) !== null, 'Invalid CVSS v3.1 vector');

const findingBase = {
  title: z.string().min(1).max(300),
  severity: z.enum(SEVERITIES).default('INFO'),
  cvssVector: cvssVector.nullish(),
  status: z.enum(FINDING_STATUSES).default('DRAFT'),
  descriptionMd: z.string().max(100000).default(''),
  impactMd: z.string().max(100000).default(''),
  recommendationMd: z.string().max(100000).default(''),
  referencesMd: z.string().max(100000).default(''),
  affectedAssets: z.array(z.string().min(1).max(500)).max(200).default([]),
  head: z.string().max(200).default(''),
  tribe: z.string().max(200).default(''),
  squad: z.string().max(200).default(''),
  techLead: z.string().max(200).default(''),
  owaspCategoryId: z.string().uuid().nullish(),
};

export const createFindingSchema = z.object(findingBase);
export const updateFindingSchema = z.object(findingBase).partial();

export const createFindingFromTemplateSchema = z.object({
  templateId: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// Finding templates
// ---------------------------------------------------------------------------

export const createTemplateSchema = z.object({
  title: z.string().min(1).max(300),
  severity: z.enum(SEVERITIES).default('INFO'),
  cvssVector: cvssVector.nullish(),
  descriptionMd: z.string().max(100000).default(''),
  impactMd: z.string().max(100000).default(''),
  recommendationMd: z.string().max(100000).default(''),
  referencesMd: z.string().max(100000).default(''),
  tags: z.array(z.string().min(1).max(50)).max(30).default([]),
  owaspCategoryId: z.string().uuid().nullish(),
});

export const updateTemplateSchema = createTemplateSchema.partial();

// ---------------------------------------------------------------------------
// Report sections
// ---------------------------------------------------------------------------

export const createSectionSchema = z.object({
  title: z.string().min(1).max(200),
  contentMd: z.string().max(200000).default(''),
});

export const updateSectionSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  contentMd: z.string().max(200000).optional(),
  order: z.number().int().min(0).max(10000).optional(),
});

// ---------------------------------------------------------------------------
// Report designs
// ---------------------------------------------------------------------------

export const createDesignSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).default(''),
  htmlTemplate: z.string().min(1).max(500000),
  css: z.string().max(500000).default(''),
  headerTemplate: z.string().max(20000).default(''),
  footerTemplate: z.string().max(20000).default(''),
  isDefault: z.boolean().default(false),
});

export const updateDesignSchema = createDesignSchema.partial();

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export const createReportSchema = z.object({
  designId: z.string().uuid().nullish(),
});

// ---------------------------------------------------------------------------
// Audit / pagination
// ---------------------------------------------------------------------------

export const auditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  action: z.string().max(100).optional(),
  actorEmail: z.string().max(200).optional(),
});

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

/** Dashboard filters: comma-separated lists and time frame (ISO dates). */
export const dashboardQuerySchema = z.object({
  projectIds: z
    .string()
    .transform((s) => s.split(',').filter(Boolean))
    .pipe(z.array(z.string().uuid()).max(100))
    .optional(),
  severities: z
    .string()
    .transform((s) => s.split(',').filter(Boolean))
    .pipe(z.array(z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'])).max(5))
    .optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;

export type LocalLoginInput = z.infer<typeof localLoginSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type CreateFindingInput = z.infer<typeof createFindingSchema>;
export type UpdateFindingInput = z.infer<typeof updateFindingSchema>;
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type CreateSectionInput = z.infer<typeof createSectionSchema>;
export type UpdateSectionInput = z.infer<typeof updateSectionSchema>;
export type CreateDesignInput = z.infer<typeof createDesignSchema>;
export type UpsertMemberInput = z.infer<typeof upsertMemberSchema>;
export type GrantAccessInput = z.infer<typeof grantAccessSchema>;
export type UpsertUserByEmailInput = z.infer<typeof upsertUserByEmailSchema>;
