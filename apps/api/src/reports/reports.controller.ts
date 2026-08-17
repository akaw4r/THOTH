import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { createReportSchema } from '@thoth/shared';
import { AuditService } from '../audit/audit.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CurrentUser, RequireProjectRole, type AuthUser } from '../auth/decorators';
import { ProjectRoleGuard } from '../auth/project-role.guard';
import { ReportsService } from './reports.service';

@Controller('projects/:projectId')
@UseGuards(ProjectRoleGuard)
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly audit: AuditService,
  ) {}

  @Get('reports')
  @RequireProjectRole('VIEWER')
  list(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.reports.list(projectId);
  }

  @Get('reports/:id')
  @RequireProjectRole('VIEWER')
  get(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.reports.get(projectId, id);
  }

  @Post('reports')
  @RequireProjectRole('EDITOR')
  async request(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body(new ZodValidationPipe(createReportSchema)) body: { designId?: string | null },
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const report = await this.reports.request(projectId, user.id, body.designId);
    await this.audit.record(
      {
        action: 'report.request',
        actorId: user.id,
        actorEmail: user.email,
        entityType: 'report',
        entityId: report.id,
        metadata: { projectId },
      },
      req,
    );
    return report;
  }

  @Delete('reports/:id')
  @RequireProjectRole('EDITOR')
  async remove(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    await this.reports.remove(projectId, id);
    await this.audit.record(
      {
        action: 'report.delete',
        actorId: user.id,
        actorEmail: user.email,
        entityType: 'report',
        entityId: id,
        metadata: { projectId },
      },
      req,
    );
    return { ok: true };
  }

  @Get('reports/:id/download')
  @RequireProjectRole('VIEWER')
  async download(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const { filename, buffer } = await this.reports.download(projectId, id);
    await this.audit.record(
      {
        action: 'report.download',
        actorId: user.id,
        actorEmail: user.email,
        entityType: 'report',
        entityId: id,
        metadata: { projectId },
      },
      req,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  }

  @Get('export/json')
  @RequireProjectRole('VIEWER')
  async exportJson(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const data = await this.reports.exportJson(projectId);
    await this.audit.record(
      {
        action: 'project.export_json',
        actorId: user.id,
        actorEmail: user.email,
        entityType: 'project',
        entityId: projectId,
      },
      req,
    );
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="thoth-project-${projectId}.json"`);
    return res.send(JSON.stringify(data, null, 2));
  }
}
