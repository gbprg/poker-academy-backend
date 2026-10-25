import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(userId: string) {
    const [sessions, attempts, completed] = await Promise.all([
      (this.prisma as any).trainingSession.count({ where: { userId } }),
      (this.prisma as any).trainingAttempt.count({ where: { userId } }),
      (this.prisma as any).trainingSession.count({ where: { userId, status: 'COMPLETED' } }),
    ]);

    const correct = await (this.prisma as any).trainingAttempt.count({
      where: { userId, score: { gte: 0.8 } },
    });

    return {
      sessions,
      attempts,
      completedSessions: completed,
      correctAttempts: correct,
      accuracy: attempts > 0 ? Number((correct / attempts).toFixed(4)) : 0,
    };
  }
}
