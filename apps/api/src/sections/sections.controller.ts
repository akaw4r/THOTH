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
  createSectionSchema,
  updateSectionSchema,
  type CreateSectionInput,
  type UpdateSectionInput,
} from '@thoth/shared';
import { AuditService } from '../audit/audit.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CurrentUser, RequireProjectRole, type AuthUser } from '../auth/decorators';
import { ProjectRoleGuard } from '../auth/project-role.guard';
import { SectionsService } from './sections.service';

@Controller('projects/:projectId/sections')
@UseGuards(ProjectRoleGuard)
export class SectionsController {
  constructor(
    private readonly sections: SectionsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequireProjectRole('VIEWER')
  list(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.sections.list(projectId);
  }

  @Post()
  @RequireProjectRole('EDITOR')
  async create(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body(new ZodValidationPipe(createSectionSchema)) body: CreateSectionInput,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const section = await this.sections.create(projectId, body);
    await this.audit.record(
      {
        action: 'section.create',
        actorId: user.id,
        actorEmail: user.email,
        entityType: 'section',
        entityId: section.id,
        metadata: { projectId },
      },
      req,
    );
    return section;
  }

  @Put(':id')
  @RequireProjectRole('EDITOR')
  async update(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateSectionSchema)) body: UpdateSectionInput,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const section = await this.sections.update(projectId, id, user, body);
    await this.audit.record(
      {
        action: 'section.update',
        actorId: user.id,
        actorEmail: user.email,
        entityType: 'section',
        entityId: id,
        metadata: { projectId },
      },
      req,
    );
    return section;
  }

  @Delete(':id')
  @RequireProjectRole('EDITOR')
  async remove(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    await this.sections.remove(projectId, id);
    await this.audit.record(
      {
        action: 'section.delete',
        actorId: user.id,
        actorEmail: user.email,
        entityType: 'section',
        entityId: id,
        metadata: { projectId },
      },
      req,
    );
    return { ok: true };
  }
}
