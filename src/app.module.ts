import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AdminUsersModule } from './modules/administration/users/admin-users.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { IdentityModule } from './modules/identity/identity.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { RangesModule } from './modules/ranges/ranges.module.js';
import { StrategyLibraryModule } from './modules/strategy-library/strategy-library.module.js';
import { CoverageModule } from './modules/strategy-library/coverage/coverage.module.js';
import { PostflopModule } from './modules/strategy-library/postflop/postflop.module.js';
import { TrainingModule } from './modules/training/training.module.js';
import { SituationsModule } from './modules/situations/situations.module.js';
import { AnalyticsModule } from './modules/analytics/analytics.module.js';
import { RATE_LIMITS } from './common/throttling.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: 'default',
          ttl: RATE_LIMITS.ttlMs,
          limit: RATE_LIMITS.globalPerMinute,
        },
      ],
      errorMessage: 'Too many requests',
    }),
    PrismaModule,
    AuthModule,
    HealthModule,
    IdentityModule,
    AdminUsersModule,
    StrategyLibraryModule,
    CoverageModule,
    RangesModule,
    PostflopModule,
    TrainingModule,
    SituationsModule,
    AnalyticsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
