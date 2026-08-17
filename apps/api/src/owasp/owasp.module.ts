import { Module } from '@nestjs/common';
import { OwaspController } from './owasp.controller';
import { OwaspService } from './owasp.service';

@Module({
  controllers: [OwaspController],
  providers: [OwaspService],
})
export class OwaspModule {}
