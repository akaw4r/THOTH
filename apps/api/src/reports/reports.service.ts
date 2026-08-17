import { Injectable, NotFoundException } from '@nestjs/common';
import type { Report } from '@prisma/client';
import { CryptoService } from '../crypto/crypto.service';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { DesignsService } from '../designs/designs.service';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
    private readonly crypto: CryptoService,
    private readonly designs: DesignsService,
  ) {}

  async list(projectId: string) {
    const reports = await this.prisma.report.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      include: {
        requestedBy: { select: { id: true, name: true } },
        design: { select: { id: true, name: true } },
      },
    });
    return reports.map((r) => this.serialize(r));
  }

  async get(projectId: string, reportId: string) {
    const r = await this.prisma.report.findFirst({
      where: { id: reportId, projectId },
      include: {
        requestedBy: { select: { id: true, name: true } },
        design: { select: { id: true, name: true } },
      },
    });
    if (!r) throw new NotFoundException('Report not found');
    return this.serialize(r);
  }

  /** Creates the report record (QUEUED) and enqueues the render job. */
  async request(projectId: string, userId: string, designId?: string | null) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');

    let resolvedDesignId = designId ?? null;
    if (!resolvedDesignId) {
      const def = await this.designs.getDefault();
      resolvedDesignId = def?.id ?? null;
    }

    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const safeName = project.name.replace(/[^a-zA-Z0-9-_]+/g, '_').slice(0, 40);
    const filename = `THOTH_${safeName}_${stamp}.pdf`;

    const report = await this.prisma.report.create({
      data: {
        projectId,
        designId: resolvedDesignId,
        requestedById: userId,
        status: 'QUEUED',
        filename,
      },
      include: {
        requestedBy: { select: { id: true, name: true } },
        design: { select: { id: true, name: true } },
      },
    });

    await this.queue.enqueueReport({ reportId: report.id, projectId });
    return this.serialize(report);
  }

  async remove(projectId: string, reportId: string) {
    const r = await this.prisma.report.findFirst({ where: { id: reportId, projectId } });
    if (!r) throw new NotFoundException('Report not found');
    await this.prisma.report.delete({ where: { id: reportId } });
  }

  async download(projectId: string, reportId: string) {
    const r = await this.prisma.report.findFirst({ where: { id: reportId, projectId } });
    if (!r) throw new NotFoundException('Report not found');
    if (r.status !== 'DONE' || !r.pdfData) {
      throw new NotFoundException('PDF is not available yet');
    }
    return {
      filename: r.filename,
      buffer: this.crypto.decryptBuffer(Buffer.from(r.pdfData)),
    };
  }

  /** Full JSON export of the project (findings + sections). */
  async exportJson(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        findings: { orderBy: [{ severity: 'asc' }, { createdAt: 'asc' }] },
        sections: { orderBy: { order: 'asc' } },
        members: { include: { user: { select: { email: true, name: true } } } },
      },
    });
    if (!project) throw new NotFoundException('Project not found');
    return {
      exportedAt: new Date().toISOString(),
      tool: 'THOTH',
      project: {
        name: project.name,
        client: project.client,
        scope: project.scope,
        status: project.status,
        startDate: project.startDate?.toISOString().slice(0, 10) ?? null,
        endDate: project.endDate?.toISOString().slice(0, 10) ?? null,
      },
      members: project.members.map((m) => ({
        email: m.user.email,
        name: m.user.name,
        role: m.role,
      })),
      sections: project.sections.map((s) => ({ title: s.title, contentMd: s.contentMd })),
      findings: project.findings.map((f) => ({
        title: f.title,
        severity: f.severity,
        cvssVector: f.cvssVector,
        cvssScore: f.cvssScore,
        status: f.status,
        descriptionMd: f.descriptionMd,
        impactMd: f.impactMd,
        recommendationMd: f.recommendationMd,
        referencesMd: f.referencesMd,
        affectedAssets: f.affectedAssets,
      })),
    };
  }

  private serialize(
    r: Report & {
      requestedBy?: { id: string; name: string } | null;
      design?: { id: string; name: string } | null;
    },
  ) {
    return {
      id: r.id,
      projectId: r.projectId,
      status: r.status,
      filename: r.filename,
      error: r.error,
      createdAt: r.createdAt.toISOString(),
      completedAt: r.completedAt?.toISOString() ?? null,
      requestedBy: r.requestedBy ?? null,
      design: r.design ?? null,
    };
  }
}
