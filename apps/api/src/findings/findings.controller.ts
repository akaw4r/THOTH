import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  createFindingFromTemplateSchema,
  createFindingSchema,
  updateFindingSchema,
  type CreateFindingInput,
  type UpdateFindingInput,
} from '@thoth/shared';
import { AuditService } from '../audit/audit.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CurrentUser, RequireProjectRole, type AuthUser } from '../auth/decorators';
import { ProjectRoleGuard } from '../auth/project-role.guard';
import { FindingsService } from './findings.service';

@Controller('projects/:projectId/findings')
@UseGuards(ProjectRoleGuard)
export class FindingsController {
  constructor(
    private readonly findings: FindingsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequireProjectRole('VIEWER')
  list(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.findings.list(projectId);
  }

  @Get(':id')
  @RequireProjectRole('VIEWER')
  get(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.findings.get(projectId, id);
  }

  @Get(':id/revisions')
  @RequireProjectRole('VIEWER')
  revisions(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.findings.revisions(projectId, id);
  }

  @Post()
  @RequireProjectRole('EDITOR')
  async create(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body(new ZodValidationPipe(createFindingSchema)) body: CreateFindingInput,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const finding = await this.findings.create(projectId, user, body);
    await this.audit.record(
      {
        action: 'finding.create',
        actorId: user.id,
        actorEmail: user.email,
        entityType: 'finding',
        entityId: finding.id,
        metadata: { projectId },
      },
      req,
    );
    return finding;
  }

  @Post('from-template')
  @RequireProjectRole('EDITOR')
  async fromTemplate(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body(new ZodValidationPipe(createFindingFromTemplateSchema)) body: { templateId: string },
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const finding = await this.findings.createFromTemplate(projectId, user, body.templateId);
    await this.audit.record(
      {
        action: 'finding.create_from_template',
        actorId: user.id,
        actorEmail: user.email,
        entityType: 'finding',
        entityId: finding.id,
        metadata: { projectId, templateId: body.templateId },
      },
      req,
    );
    return finding;
  }

  @Put(':id')
  @RequireProjectRole('EDITOR')
  async update(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateFindingSchema)) body: UpdateFindingInput,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const finding = await this.findings.update(projectId, id, user, body);
    await this.audit.record(
      {
        action: 'finding.update',
        actorId: user.id,
        actorEmail: user.email,
        entityType: 'finding',
        entityId: id,
        metadata: { projectId },
      },
      req,
    );
    return finding;
  }

  @Delete(':id')
  @RequireProjectRole('EDITOR')
  async remove(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    await this.findings.remove(projectId, id);
    await this.audit.record(
      {
        action: 'finding.delete',
        actorId: user.id,
        actorEmail: user.email,
        entityType: 'finding',
        entityId: id,
        metadata: { projectId },
      },
      req,
    );
    return { ok: true };
  }
}
