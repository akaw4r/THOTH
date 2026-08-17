import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ALLOWED_UPLOAD_MIME, MAX_UPLOAD_BYTES } from '@thoth/shared';
import { CryptoService } from '../crypto/crypto.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/decorators';

interface UploadFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/** Signatures (magic bytes) to validate that the content matches the MIME type. */
const MAGIC: Array<{ mime: string; test: (b: Buffer) => boolean }> = [
  {
    mime: 'image/png',
    test: (b) =>
      b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  { mime: 'image/jpeg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/gif', test: (b) => b.subarray(0, 3).toString('ascii') === 'GIF' },
  {
    mime: 'image/webp',
    test: (b) =>
      b.subarray(0, 4).toString('ascii') === 'RIFF' &&
      b.subarray(8, 12).toString('ascii') === 'WEBP',
  },
  { mime: 'application/pdf', test: (b) => b.subarray(0, 5).toString('ascii') === '%PDF-' },
  { mime: 'text/plain', test: () => true },
];

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  private validate(file: UploadFile): void {
    if (!file || !file.buffer?.length) throw new BadRequestException('Empty file');
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new BadRequestException(`File exceeds ${MAX_UPLOAD_BYTES / 1024 / 1024} MiB`);
    }
    if (!(ALLOWED_UPLOAD_MIME as readonly string[]).includes(file.mimetype)) {
      throw new BadRequestException(`File type not allowed: ${file.mimetype}`);
    }
    const magic = MAGIC.find((m) => m.mime === file.mimetype);
    if (magic && !magic.test(file.buffer)) {
      throw new BadRequestException('File content does not match the declared type');
    }
  }

  async upload(projectId: string, user: AuthUser, file: UploadFile, findingId?: string) {
    this.validate(file);
    if (findingId) {
      const finding = await this.prisma.finding.findFirst({ where: { id: findingId, projectId } });
      if (!finding) throw new NotFoundException('Finding not found in this project');
    }
    const created = await this.prisma.attachment.create({
      data: {
        projectId,
        findingId: findingId ?? null,
        filename: file.originalname.slice(0, 255),
        mimeType: file.mimetype,
        size: file.size,
        data: this.crypto.encryptBuffer(file.buffer),
        uploadedById: user.id,
      },
    });
    return this.serialize(created);
  }

  async list(projectId: string) {
    const items = await this.prisma.attachment.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
    return items.map((a) => this.serialize(a));
  }

  /** Decrypts and returns the raw content for download/preview. */
  async raw(projectId: string, attachmentId: string) {
    const a = await this.prisma.attachment.findFirst({ where: { id: attachmentId, projectId } });
    if (!a) throw new NotFoundException('Attachment not found');
    return {
      filename: a.filename,
      mimeType: a.mimeType,
      buffer: this.crypto.decryptBuffer(Buffer.from(a.data)),
    };
  }

  async remove(projectId: string, attachmentId: string) {
    const a = await this.prisma.attachment.findFirst({ where: { id: attachmentId, projectId } });
    if (!a) throw new NotFoundException('Attachment not found');
    await this.prisma.attachment.delete({ where: { id: attachmentId } });
  }

  private serialize(a: {
    id: string;
    projectId: string;
    findingId: string | null;
    filename: string;
    mimeType: string;
    size: number;
    createdAt: Date;
  }) {
    return {
      id: a.id,
      projectId: a.projectId,
      findingId: a.findingId,
      filename: a.filename,
      mimeType: a.mimeType,
      size: a.size,
      createdAt: a.createdAt.toISOString(),
    };
  }
}
