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

  async byStreet(userId: string) {
    const attempts = await (this.prisma as any).trainingAttempt.findMany({
      where: { userId },
      select: { score: true, question: { select: { session: { select: { spot: { select: { street: true } } } } } } },
      take: 1000,
    });

    const map = new Map<string, { total: number; correct: number }>();
    for (const a of attempts as any[]) {
      const street = a.question?.session?.spot?.street ?? "UNKNOWN";
      const cur = map.get(street) ?? { total: 0, correct: 0 };
      cur.total += 1;
      if (Number(a.score) >= 0.8) cur.correct += 1;
      map.set(street, cur);
    }

    const items = Array.from(map.entries()).map(([street, v]: [string, any]) => ({
      street,
      total: v.total,
      correct: v.correct,
      accuracy: v.total > 0 ? Number((v.correct / v.total).toFixed(4)) : 0,
    }));

    return { items };
  }
}
