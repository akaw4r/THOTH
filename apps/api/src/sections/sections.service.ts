import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, ReportSection } from '@prisma/client';
import type { CreateSectionInput, UpdateSectionInput } from '@thoth/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/decorators';

function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // strip diacritics
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 60) || 'section'
  );
}

@Injectable()
export class SectionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(projectId: string) {
    const sections = await this.prisma.reportSection.findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
    });
    return sections.map((s) => this.serialize(s));
  }

  private async uniqueSlug(projectId: string, title: string): Promise<string> {
    const base = slugify(title);
    let slug = base;
    let n = 1;
    while (
      await this.prisma.reportSection.findUnique({ where: { projectId_slug: { projectId, slug } } })
    ) {
      slug = `${base}-${++n}`;
    }
    return slug;
  }

  async create(projectId: string, input: CreateSectionInput) {
    const max = await this.prisma.reportSection.aggregate({
      where: { projectId },
      _max: { order: true },
    });
    const slug = await this.uniqueSlug(projectId, input.title);
    const section = await this.prisma.reportSection.create({
      data: {
        projectId,
        title: input.title,
        slug,
        contentMd: input.contentMd,
        order: (max._max.order ?? -1) + 1,
      },
    });
    return this.serialize(section);
  }

  async update(projectId: string, sectionId: string, user: AuthUser, input: UpdateSectionInput) {
    const current = await this.prisma.reportSection.findFirst({
      where: { id: sectionId, projectId },
    });
    if (!current) throw new NotFoundException('Section not found');

    const data: Record<string, unknown> = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.contentMd !== undefined) data.contentMd = input.contentMd;
    if (input.order !== undefined) data.order = input.order;

    const [, updated] = await this.prisma.$transaction([
      this.prisma.sectionRevision.create({
        data: {
          sectionId,
          editedById: user.id,
          editedByName: user.name,
          snapshot: {
            title: current.title,
            contentMd: current.contentMd,
            order: current.order,
          } as Prisma.InputJsonValue,
        },
      }),
      this.prisma.reportSection.update({ where: { id: sectionId }, data }),
    ]);
    return this.serialize(updated);
  }

  async remove(projectId: string, sectionId: string) {
    const current = await this.prisma.reportSection.findFirst({
      where: { id: sectionId, projectId },
    });
    if (!current) throw new NotFoundException('Section not found');
    await this.prisma.reportSection.delete({ where: { id: sectionId } });
  }

  private serialize(s: ReportSection) {
    return {
      id: s.id,
      projectId: s.projectId,
      title: s.title,
      slug: s.slug,
      order: s.order,
      contentMd: s.contentMd,
      updatedAt: s.updatedAt.toISOString(),
    };
  }
}
