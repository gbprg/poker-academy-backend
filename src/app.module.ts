import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdminUsersModule } from './modules/administration/users/admin-users.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { IdentityModule } from './modules/identity/identity.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    HealthModule,
    IdentityModule,
    AdminUsersModule,
  ],
})
export class AppModule {}
