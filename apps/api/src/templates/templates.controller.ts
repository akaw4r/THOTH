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
  createTemplateSchema,
  updateTemplateSchema,
  type CreateTemplateInput,
} from '@thoth/shared';
import { AuditService } from '../audit/audit.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CurrentUser, Roles, type AuthUser } from '../auth/decorators';
import { RolesGuard } from '../auth/roles.guard';
import { TemplatesService } from './templates.service';

@Controller('templates')
@UseGuards(RolesGuard)
export class TemplatesController {
  constructor(
    private readonly templates: TemplatesService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list() {
    return this.templates.list();
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.templates.get(id);
  }

  @Post()
  @Roles('ADMIN', 'AUTHOR')
  async create(
    @Body(new ZodValidationPipe(createTemplateSchema)) body: CreateTemplateInput,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const t = await this.templates.create(user, body);
    await this.audit.record(
      {
        action: 'template.create',
        actorId: user.id,
        actorEmail: user.email,
        entityType: 'template',
        entityId: t.id,
      },
      req,
    );
    return t;
  }

  @Put(':id')
  @Roles('ADMIN', 'AUTHOR')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateTemplateSchema)) body: Partial<CreateTemplateInput>,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const t = await this.templates.update(id, body);
    await this.audit.record(
      {
        action: 'template.update',
        actorId: user.id,
        actorEmail: user.email,
        entityType: 'template',
        entityId: id,
      },
      req,
    );
    return t;
  }

  @Delete(':id')
  @Roles('ADMIN', 'AUTHOR')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    await this.templates.remove(id);
    await this.audit.record(
      {
        action: 'template.delete',
        actorId: user.id,
        actorEmail: user.email,
        entityType: 'template',
        entityId: id,
      },
      req,
    );
    return { ok: true };
  }
}
