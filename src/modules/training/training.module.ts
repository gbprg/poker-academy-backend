import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { TrainingController } from './training.controller.js';
import { TrainingService } from './training.service.js';
import { TrainingScoringService } from './training-scoring.service.js';

@Module({
  imports: [AuthModule],
  controllers: [TrainingController],
  providers: [TrainingService, TrainingScoringService],
  exports: [TrainingService],
})
export class TrainingModule {}
