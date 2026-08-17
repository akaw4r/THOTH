import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { dashboardQuerySchema, type DashboardQuery } from '@thoth/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CurrentUser, type AuthUser } from '../auth/decorators';
import { RolesGuard } from '../auth/roles.guard';
import { DashboardService } from './dashboard.service';

/**
 * Aggregated metrics for the dashboard. Any authenticated user: the service
 * restricts everything to the projects visible to them.
 */
@Controller('dashboard')
@UseGuards(RolesGuard)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('metrics')
  metrics(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(dashboardQuerySchema)) query: DashboardQuery,
  ) {
    return this.dashboard.metrics(user, query);
  }
}
