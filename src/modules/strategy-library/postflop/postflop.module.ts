import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module.js';
import { PostflopController } from './postflop.controller.js';
import { PostflopRepository } from './postflop.repository.js';
import { PostflopService } from './postflop.service.js';

@Module({
  imports: [AuthModule],
  controllers: [PostflopController],
  providers: [PostflopService, PostflopRepository],
  exports: [PostflopService],
})
export class PostflopModule {}
