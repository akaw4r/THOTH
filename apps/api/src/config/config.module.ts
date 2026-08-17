import { Global, Module } from '@nestjs/common';
import { ConfigService } from './config.service';

@Global()
@Module({
  providers: [{ provide: ConfigService, useFactory: () => new ConfigService() }],
  exports: [ConfigService],
})
export class ConfigModule {}
