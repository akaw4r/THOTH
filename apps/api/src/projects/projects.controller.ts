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
  createProjectSchema,
  updateProjectSchema,
  upsertMemberSchema,
  type CreateProjectInput,
  type UpdateProjectInput,
  type UpsertMemberInput,
} from '@thoth/shared';
import { AuditService } from '../audit/audit.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CurrentUser, RequireProjectRole, Roles, type AuthUser } from '../auth/decorators';
import { ProjectRoleGuard } from '../auth/project-role.guard';
import { RolesGuard } from '../auth/roles.guard';
import { ProjectsService } from './projects.service';

@Controller('projects')
@UseGuards(RolesGuard, ProjectRoleGuard)
export class ProjectsController {
  constructor(
    private readonly projects: ProjectsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.projects.list(user);
  }

  @Post()
  @Roles('ADMIN', 'AUTHOR')
  async create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createProjectSchema)) body: CreateProjectInput,
    @Req() req: Request,
  ) {
    const project = await this.projects.create(user, body);
    await this.audit.record(
      {
        action: 'project.create',
        actorId: user.id,
        actorEmail: user.email,
        entityType: 'project',
        entityId: project.id,
        metadata: { name: project.name },
      },
      req,
    );
    return project;
  }

  @Get(':id')
  @RequireProjectRole('VIEWER')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.projects.detail(id);
  }

  @Put(':id')
  @RequireProjectRole('MANAGER')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateProjectSchema)) body: UpdateProjectInput,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const project = await this.projects.update(id, body);
    await this.audit.record(
      {
        action: 'project.update',
        actorId: user.id,
        actorEmail: user.email,
        entityType: 'project',
        entityId: id,
      },
      req,
    );
    return project;
  }

  @Delete(':id')
  @RequireProjectRole('MANAGER')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    await this.projects.remove(id);
    await this.audit.record(
      {
        action: 'project.delete',
        actorId: user.id,
        actorEmail: user.email,
        entityType: 'project',
        entityId: id,
      },
      req,
    );
    return { ok: true };
  }

  // ---- members (MANAGER only) ---------------------------------------------

  @Post(':id/members')
  @RequireProjectRole('MANAGER')
  async upsertMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(upsertMemberSchema))
    body: UpsertMemberInput,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const project = await this.projects.addOrUpdateMember(
      id,
      { userId: body.userId, email: body.email },
      body.role,
    );
    await this.audit.record(
      {
        action: 'project.member.upsert',
        actorId: user.id,
        actorEmail: user.email,
        entityType: 'project',
        entityId: id,
        metadata: { userId: body.userId, email: body.email, role: body.role },
      },
      req,
    );
    return project;
  }

  @Delete(':id/members/:userId')
  @RequireProjectRole('MANAGER')
  async removeMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const project = await this.projects.removeMember(id, userId);
    await this.audit.record(
      {
        action: 'project.member.remove',
        actorId: user.id,
        actorEmail: user.email,
        entityType: 'project',
        entityId: id,
        metadata: { userId },
      },
      req,
    );
    return project;
  }
}
