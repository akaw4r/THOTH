import { Injectable, NotFoundException } from '@nestjs/common';
import type { FindingTemplate, OwaspCategory, Prisma } from '@prisma/client';
import type { CreateTemplateInput } from '@thoth/shared';
import { PrismaService } from '../prisma/prisma.service';
import { serializeOwasp } from '../owasp/owasp.serialize';
import type { AuthUser } from '../auth/decorators';

const TEMPLATE_INCLUDE = { owaspCategory: true } satisfies Prisma.FindingTemplateInclude;

type TemplateWithRelations = FindingTemplate & { owaspCategory?: OwaspCategory | null };

@Injectable()
export class TemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const items = await this.prisma.findingTemplate.findMany({
      orderBy: { title: 'asc' },
      include: TEMPLATE_INCLUDE,
    });
    return items.map((t) => this.serialize(t));
  }

  async get(id: string) {
    const t = await this.prisma.findingTemplate.findUnique({
      where: { id },
      include: TEMPLATE_INCLUDE,
    });
    if (!t) throw new NotFoundException('Template not found');
    return this.serialize(t);
  }

  async create(user: AuthUser, input: CreateTemplateInput) {
    const t = await this.prisma.findingTemplate.create({
      data: {
        ...input,
        cvssVector: input.cvssVector ?? null,
        owaspCategoryId: input.owaspCategoryId ?? null,
        createdById: user.id,
      },
      include: TEMPLATE_INCLUDE,
    });
    return this.serialize(t);
  }

  async update(id: string, input: Partial<CreateTemplateInput>) {
    await this.get(id);
    const t = await this.prisma.findingTemplate.update({
      where: { id },
      data: {
        ...input,
        cvssVector: input.cvssVector === undefined ? undefined : (input.cvssVector ?? null),
        owaspCategoryId:
          input.owaspCategoryId === undefined ? undefined : (input.owaspCategoryId ?? null),
      },
      include: TEMPLATE_INCLUDE,
    });
    return this.serialize(t);
  }

  async remove(id: string) {
    await this.get(id);
    await this.prisma.findingTemplate.delete({ where: { id } });
  }

  private serialize(t: TemplateWithRelations) {
    return {
      id: t.id,
      title: t.title,
      severity: t.severity,
      cvssVector: t.cvssVector,
      descriptionMd: t.descriptionMd,
      impactMd: t.impactMd,
      recommendationMd: t.recommendationMd,
      referencesMd: t.referencesMd,
      tags: t.tags,
      owaspCategoryId: t.owaspCategoryId,
      owaspCategory: serializeOwasp(t.owaspCategory ?? null),
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    };
  }
}
