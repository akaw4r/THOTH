import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { serializeOwasp } from './owasp.serialize';

@Injectable()
export class OwaspService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lists the categories in the official order (family and order). */
  async list() {
    const items = await this.prisma.owaspCategory.findMany({
      orderBy: [{ family: 'asc' }, { order: 'asc' }],
    });
    return items.map((c) => serializeOwasp(c)!);
  }
}
