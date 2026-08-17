import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { grantAccessSchema, type GrantAccessInput } from '@thoth/shared';
import { AuditService } from '../audit/audit.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CurrentUser, Roles, type AuthUser } from '../auth/decorators';
import { RolesGuard } from '../auth/roles.guard';
import { ProjectsService } from './projects.service';

/**
 * Batch access grant: one email, one role, one or more projects.
 * Global ADMIN only (the admin grants access to editors/viewers). Cross-project,
 * so it lives outside ProjectsController (which applies ProjectRoleGuard per :id).
 */
@Controller('access')
@UseGuards(RolesGuard)
export class AccessController {
  constructor(
    private readonly projects: ProjectsService,
    private readonly audit: AuditService,
  ) {}

  @Post('grants')
  @Roles('ADMIN')
  async grant(
    @Body(new ZodValidationPipe(grantAccessSchema)) body: GrantAccessInput,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const result = await this.projects.grantAccess(body.email, body.role, body.projectIds);
    await this.audit.record(
      {
        action: 'access.grant',
        actorId: user.id,
        actorEmail: user.email,
        entityType: 'user',
        entityId: result.userId,
        metadata: { email: result.email, role: result.role, projectCount: result.projectCount },
      },
      req,
    );
    return result;
  }
}
