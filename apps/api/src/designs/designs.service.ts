import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, ReportDesign } from '@prisma/client';
import { DEFAULT_DESIGN } from '@thoth/shared/node';
import type { CreateDesignInput } from '@thoth/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DesignsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Ensures the default design exists (idempotent — called by the seed). */
  async ensureDefault(): Promise<void> {
    const existing = await this.prisma.reportDesign.findFirst({ where: { isDefault: true } });
    if (existing) return;
    await this.prisma.reportDesign.create({
      data: {
        name: DEFAULT_DESIGN.name,
        description: DEFAULT_DESIGN.description,
        htmlTemplate: DEFAULT_DESIGN.htmlTemplate,
        css: DEFAULT_DESIGN.css,
        headerTemplate: DEFAULT_DESIGN.headerTemplate,
        footerTemplate: DEFAULT_DESIGN.footerTemplate,
        isDefault: true,
      },
    });
  }

  async list() {
    const items = await this.prisma.reportDesign.findMany({ orderBy: { name: 'asc' } });
    return items.map((d) => this.serialize(d));
  }

  async get(id: string) {
    const d = await this.prisma.reportDesign.findUnique({ where: { id } });
    if (!d) throw new NotFoundException('Design not found');
    return this.serialize(d);
  }

  async getDefault() {
    const d = await this.prisma.reportDesign.findFirst({ where: { isDefault: true } });
    if (!d) {
      await this.ensureDefault();
      return this.prisma.reportDesign.findFirst({ where: { isDefault: true } });
    }
    return d;
  }

  async create(input: CreateDesignInput) {
    const d = await this.prisma.reportDesign.create({
      data: {
        name: input.name,
        description: input.description,
        htmlTemplate: input.htmlTemplate,
        css: input.css,
        headerTemplate: input.headerTemplate,
        footerTemplate: input.footerTemplate,
      },
    });
    if (input.isDefault) await this.setDefault(d.id);
    return this.serialize(d);
  }

  async update(id: string, input: Partial<CreateDesignInput>) {
    await this.get(id);
    const d = await this.prisma.reportDesign.update({ where: { id }, data: this.data(input) });
    if (input.isDefault) await this.setDefault(id);
    return this.serialize(d);
  }

  async remove(id: string) {
    const d = await this.prisma.reportDesign.findUnique({ where: { id } });
    if (!d) throw new NotFoundException('Design not found');
    if (d.isDefault) throw new NotFoundException('The default design cannot be removed');
    await this.prisma.reportDesign.delete({ where: { id } });
  }

  /** Only one design can be the default. */
  private async setDefault(id: string) {
    await this.prisma.$transaction([
      this.prisma.reportDesign.updateMany({ where: { NOT: { id } }, data: { isDefault: false } }),
      this.prisma.reportDesign.update({ where: { id }, data: { isDefault: true } }),
    ]);
  }

  private data(input: Partial<CreateDesignInput>): Prisma.ReportDesignUpdateInput {
    const d: Prisma.ReportDesignUpdateInput = {};
    for (const k of [
      'name',
      'description',
      'htmlTemplate',
      'css',
      'headerTemplate',
      'footerTemplate',
    ] as const) {
      if (input[k] !== undefined) d[k] = input[k];
    }
    return d;
  }

  private serialize(d: ReportDesign) {
    return {
      id: d.id,
      name: d.name,
      description: d.description,
      htmlTemplate: d.htmlTemplate,
      css: d.css,
      headerTemplate: d.headerTemplate,
      footerTemplate: d.footerTemplate,
      isDefault: d.isDefault,
      updatedAt: d.updatedAt.toISOString(),
    };
  }
}
