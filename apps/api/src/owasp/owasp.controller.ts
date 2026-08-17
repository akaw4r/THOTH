import { Controller, Get, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../auth/roles.guard';
import { OwaspService } from './owasp.service';

/** Read-only catalog of OWASP categories (for frontend selects). */
@Controller('owasp-categories')
@UseGuards(RolesGuard)
export class OwaspController {
  constructor(private readonly owasp: OwaspService) {}

  @Get()
  list() {
    return this.owasp.list();
  }
}
