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
import { createDesignSchema, updateDesignSchema, type CreateDesignInput } from '@thoth/shared';
import { AuditService } from '../audit/audit.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CurrentUser, Roles, type AuthUser } from '../auth/decorators';
import { RolesGuard } from '../auth/roles.guard';
import { DesignsService } from './designs.service';

@Controller('designs')
@UseGuards(RolesGuard)
export class DesignsController {
  constructor(
    private readonly designs: DesignsService,
    private readonly audit: AuditService,
  ) {}

  // Readable by any authenticated user (used when requesting a report).
  @Get()
  list() {
    return this.designs.list();
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.designs.get(id);
  }

  // Design editing is sensitive (affects all reports) → ADMIN only.
  @Post()
  @Roles('ADMIN')
  async create(
    @Body(new ZodValidationPipe(createDesignSchema)) body: CreateDesignInput,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const d = await this.designs.create(body);
    await this.audit.record(
      {
        action: 'design.create',
        actorId: user.id,
        actorEmail: user.email,
        entityType: 'design',
        entityId: d.id,
      },
      req,
    );
    return d;
  }

  @Put(':id')
  @Roles('ADMIN')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateDesignSchema)) body: Partial<CreateDesignInput>,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const d = await this.designs.update(id, body);
    await this.audit.record(
      {
        action: 'design.update',
        actorId: user.id,
        actorEmail: user.email,
        entityType: 'design',
        entityId: id,
      },
      req,
    );
    return d;
  }

  @Delete(':id')
  @Roles('ADMIN')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    await this.designs.remove(id);
    await this.audit.record(
      {
        action: 'design.delete',
        actorId: user.id,
        actorEmail: user.email,
        entityType: 'design',
        entityId: id,
      },
      req,
    );
    return { ok: true };
  }
}
