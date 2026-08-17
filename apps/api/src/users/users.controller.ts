import {
  Body,
  Controller,
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
  updateUserRoleSchema,
  upsertUserByEmailSchema,
  type Role,
  type UpsertUserByEmailInput,
} from '@thoth/shared';
import { AuditService } from '../audit/audit.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CurrentUser, Roles, type AuthUser } from '../auth/decorators';
import { RolesGuard } from '../auth/roles.guard';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(RolesGuard)
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly audit: AuditService,
  ) {}

  /** Lists users — used in the project member selector. */
  @Get()
  list() {
    return this.users.list();
  }

  /** Adds/promotes a user by email with a global role (including ADMIN). */
  @Post()
  @Roles('ADMIN')
  async upsertByEmail(
    @Body(new ZodValidationPipe(upsertUserByEmailSchema)) body: UpsertUserByEmailInput,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    const user = await this.users.upsertByEmail(body.email, body.role);
    await this.audit.record(
      {
        action: 'user.upsert_by_email',
        actorId: actor.id,
        actorEmail: actor.email,
        entityType: 'user',
        entityId: user.id,
        metadata: { email: user.email, role: body.role },
      },
      req,
    );
    return user;
  }

  @Put(':id/role')
  @Roles('ADMIN')
  async updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateUserRoleSchema)) body: { role: Role },
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    const user = await this.users.updateRole(id, body.role);
    await this.audit.record(
      {
        action: 'user.role_update',
        actorId: actor.id,
        actorEmail: actor.email,
        entityType: 'user',
        entityId: id,
        metadata: { role: body.role },
      },
      req,
    );
    return user;
  }
}
