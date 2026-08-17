import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { LocalAuthController } from './local-auth.controller';
import { OidcService } from './oidc.service';
import { LocalAuthService } from './local-auth.service';
import { MfaService } from './mfa.service';
import { UserProvisioningService } from './user-provisioning.service';
import { ProjectAccessService } from './project-access.service';
import { GoogleDirectoryService } from './google-directory.service';

@Module({
  controllers: [AuthController, LocalAuthController],
  providers: [
    OidcService,
    LocalAuthService,
    MfaService,
    UserProvisioningService,
    ProjectAccessService,
    GoogleDirectoryService,
  ],
  exports: [ProjectAccessService, MfaService, LocalAuthService],
})
export class AuthModule {}
