import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AccessController } from './access.controller';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  imports: [AuthModule],
  controllers: [ProjectsController, AccessController],
  providers: [ProjectsService],
})
export class ProjectsModule {}
