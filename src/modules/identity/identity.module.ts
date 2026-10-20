import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { BootstrapAdminService } from './bootstrap-admin.service.js';
import { IdentityRepository } from './identity.repository.js';

@Module({
  imports: [AuthModule],
  providers: [BootstrapAdminService, IdentityRepository],
  exports: [BootstrapAdminService, IdentityRepository],
})
export class IdentityModule {}
