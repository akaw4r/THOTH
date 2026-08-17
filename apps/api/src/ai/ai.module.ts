import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AiController, ProjectAiController } from './ai.controller';
import { AiService } from './ai.service';

@Module({
  // AuthModule fornece o ProjectAccessService usado pelo ProjectRoleGuard.
  imports: [AuthModule],
  controllers: [AiController, ProjectAiController],
  providers: [AiService],
})
export class AiModule {}
