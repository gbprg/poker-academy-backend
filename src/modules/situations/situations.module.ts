import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module.js';
import { SituationsController } from './situations.controller.js';
import { SituationsService } from './situations.service.js';

@Module({
  imports: [AuthModule],
  controllers: [SituationsController],
  providers: [SituationsService],
  exports: [SituationsService],
})
export class SituationsModule {}
