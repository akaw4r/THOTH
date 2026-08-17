import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { MAX_UPLOAD_BYTES } from '@thoth/shared';
import { AuditService } from '../audit/audit.service';
import { CurrentUser, RequireProjectRole, type AuthUser } from '../auth/decorators';
import { ProjectRoleGuard } from '../auth/project-role.guard';
import { AttachmentsService } from './attachments.service';

@Controller('projects/:projectId/attachments')
@UseGuards(ProjectRoleGuard)
export class AttachmentsController {
  constructor(
    private readonly attachments: AttachmentsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequireProjectRole('VIEWER')
  list(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.attachments.list(projectId);
  }

  @Post()
  @RequireProjectRole('EDITOR')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  async upload(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @UploadedFile() file: Express.Multer.File,
    @Query('findingId') findingId: string | undefined,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const att = await this.attachments.upload(projectId, user, file, findingId);
    await this.audit.record(
      {
        action: 'attachment.upload',
        actorId: user.id,
        actorEmail: user.email,
        entityType: 'attachment',
        entityId: att.id,
        metadata: { projectId, filename: att.filename },
      },
      req,
    );
    return att;
  }

  @Get(':id/raw')
  @RequireProjectRole('VIEWER')
  async raw(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const { filename, mimeType, buffer } = await this.attachments.raw(projectId, id);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.send(buffer);
  }

  @Delete(':id')
  @RequireProjectRole('EDITOR')
  async remove(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    await this.attachments.remove(projectId, id);
    await this.audit.record(
      {
        action: 'attachment.delete',
        actorId: user.id,
        actorEmail: user.email,
        entityType: 'attachment',
        entityId: id,
        metadata: { projectId },
      },
      req,
    );
    return { ok: true };
  }
}
