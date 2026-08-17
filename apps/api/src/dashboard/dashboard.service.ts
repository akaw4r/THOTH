import { Injectable } from '@nestjs/common';
import {
  FINDING_STATUSES,
  OWASP_FAMILIES,
  PROJECT_STATUSES,
  SEVERITIES,
  type DashboardMetrics,
  type DashboardQuery,
  type FindingStatus,
  type OwaspFamily,
  type ProjectStatus,
  type Severity,
} from '@thoth/shared';
import type { Prisma } from '@prisma/client';
import type { AuthUser } from '../auth/decorators';
import { ProjectAccessService } from '../auth/project-access.service';
import { PrismaService } from '../prisma/prisma.service';

/** Weight of each severity in the risk score (the higher, the worse). */
const RISK_WEIGHTS: Record<Severity, number> = {
  CRITICAL: 15,
  HIGH: 8,
  MEDIUM: 3,
  LOW: 1,
  INFO: 0,
};

function riskGrade(score: number): DashboardMetrics['risk']['grade'] {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  if (score >= 20) return 'E';
  return 'F';
}

function emptyRecord<K extends string>(keys: readonly K[]): Record<K, number> {
  return Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
  ) {}

  /**
   * Aggregates the dashboard metrics ALWAYS within the projects visible to the
   * user (admin: all; others: only where they are a member), refined by the
   * project/severity/period filters.
   */
  async metrics(user: AuthUser, query: DashboardQuery): Promise<DashboardMetrics> {
    const visible = await this.access.visibleProjectFilter(user);

    // Intersection between the requested filter and what the user can see.
    const projectWhere: Prisma.ProjectWhereInput = { ...visible };
    if (query.projectIds?.length) {
      const allowed = visible.id
        ? query.projectIds.filter((id) => visible.id!.in.includes(id))
        : query.projectIds;
      projectWhere.id = { in: allowed };
    }

    const findingWhere: Prisma.FindingWhereInput = { project: projectWhere };
    if (query.severities?.length) findingWhere.severity = { in: query.severities };
    if (query.from || query.to) {
      findingWhere.createdAt = {
        ...(query.from ? { gte: query.from } : {}),
        ...(query.to ? { lte: endOfDay(query.to) } : {}),
      };
    }

    const [projects, findings, reports] = await Promise.all([
      this.prisma.project.findMany({ where: projectWhere, select: { id: true, status: true } }),
      this.prisma.finding.findMany({
        where: findingWhere,
        select: {
          severity: true,
          status: true,
          affectedAssets: true,
          createdAt: true,
          owaspCategory: { select: { code: true, name: true, family: true } },
        },
      }),
      this.prisma.report.findMany({
        where: { project: projectWhere, status: 'DONE' },
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
          id: true,
          projectId: true,
          filename: true,
          createdAt: true,
          project: { select: { name: true } },
        },
      }),
    ]);

    const severityCounts = emptyRecord<Severity>(SEVERITIES);
    const statusCounts = emptyRecord<FindingStatus>(FINDING_STATUSES);
    const familyCounts = emptyRecord<OwaspFamily>(OWASP_FAMILIES);
    const owaspMap = new Map<string, DashboardMetrics['topOwasp'][number]>();
    const assetMap = new Map<string, { total: number; criticalHigh: number }>();

    for (const f of findings) {
      severityCounts[f.severity] += 1;
      statusCounts[f.status] += 1;
      if (f.owaspCategory) {
        familyCounts[f.owaspCategory.family] += 1;
        const entry = owaspMap.get(f.owaspCategory.code) ?? {
          code: f.owaspCategory.code,
          name: f.owaspCategory.name,
          family: f.owaspCategory.family,
          count: 0,
        };
        entry.count += 1;
        owaspMap.set(f.owaspCategory.code, entry);
      }
      const grave = f.severity === 'CRITICAL' || f.severity === 'HIGH';
      for (const asset of f.affectedAssets) {
        const a = assetMap.get(asset) ?? { total: 0, criticalHigh: 0 };
        a.total += 1;
        if (grave) a.criticalHigh += 1;
        assetMap.set(asset, a);
      }
    }

    // Risk score: 100 - sum of the weights, floored at 0. Transparent and
    // deterministic — the formula appears in the card description on the frontend.
    const penalty = findings.reduce((acc, f) => acc + RISK_WEIGHTS[f.severity], 0);
    const score = Math.max(0, 100 - penalty);

    const projectPipeline = emptyRecord<ProjectStatus>(PROJECT_STATUSES);
    for (const p of projects) projectPipeline[p.status] += 1;

    return {
      totals: { projects: projects.length, findings: findings.length, assets: assetMap.size },
      risk: { score, grade: riskGrade(score) },
      severityCounts,
      statusCounts,
      topOwasp: [...owaspMap.values()].sort((a, b) => b.count - a.count).slice(0, 10),
      topAssets: [...assetMap.entries()]
        .map(([asset, v]) => ({ asset, ...v }))
        .sort((a, b) => b.criticalHigh - a.criticalHigh || b.total - a.total)
        .slice(0, 10),
      familyCounts,
      projectPipeline,
      trend: buildTrend(findings),
      recentReports: reports.map((r) => ({
        id: r.id,
        projectId: r.projectId,
        projectName: r.project.name,
        filename: r.filename,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }
}

function endOfDay(d: Date): Date {
  const end = new Date(d);
  end.setUTCHours(23, 59, 59, 999);
  return end;
}

/** New findings per month over the last 12 months (includes zeroed months). */
function buildTrend(
  findings: Array<{ severity: Severity; createdAt: Date }>,
): DashboardMetrics['trend'] {
  const now = new Date();
  const months: DashboardMetrics['trend'] = [];
  const index = new Map<string, number>();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    index.set(key, months.length);
    months.push({ month: key, total: 0, criticalHigh: 0 });
  }
  for (const f of findings) {
    const key = `${f.createdAt.getUTCFullYear()}-${String(f.createdAt.getUTCMonth() + 1).padStart(2, '0')}`;
    const i = index.get(key);
    if (i === undefined) continue;
    months[i].total += 1;
    if (f.severity === 'CRITICAL' || f.severity === 'HIGH') months[i].criticalHigh += 1;
  }
  return months;
}
