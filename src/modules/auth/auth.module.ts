import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AccessTokenService } from './access-token.service.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { PasswordService } from './password.service.js';
import { RolesGuard } from './roles.guard.js';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AccessTokenService,
    AuthService,
    JwtAuthGuard,
    PasswordService,
    RolesGuard,
  ],
  exports: [AccessTokenService, JwtAuthGuard, PasswordService, RolesGuard],
})
export class AuthModule {}
