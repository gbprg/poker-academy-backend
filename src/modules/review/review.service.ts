import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class ReviewService {
  constructor(private readonly prisma: PrismaService) {}

  async getDue(userId: string) {
    const now = new Date();
    const items = await this.prisma.reviewItem.findMany({
      where: {
        userId,
        dueAt: { lte: now },
      },
      take: 50,
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }],
    });

    const versionIds = [...new Set(items.map((item) => item.strategyVersionId))];
    const versions = await this.prisma.strategyVersion.findMany({
      where: {
        id: { in: versionIds },
        status: 'PUBLISHED',
      },
      select: {
        id: true,
        spotId: true,
        spot: { select: { spotKey: true, format: true, street: true, tableSize: true } },
      },
    });
    const published = new Set(versions.map((version) => version.id));
    const spotByVersion = new Map(
      versions.map((version) => [version.id, (version as any).spot]),
    );

    const eligible = items.filter((item) => published.has(item.strategyVersionId));

    return {
      count: eligible.length,
      items: eligible.map((item: any) => ({
        id: item.id,
        spotId: item.spotId,
        strategyVersionId: item.strategyVersionId,
        nodeId: item.nodeId,
        dueAt: item.dueAt,
        spot: spotByVersion.get(item.strategyVersionId) ?? null,
      })),
    };
  }
}

  async answer(userId: string, dto: ReviewAnswerDto) {
    const item = await this.prisma.reviewItem.findFirst({
      where: { id: dto.reviewItemId, userId },
    });

    if (!item) {
      throw new NotFoundException('Item de revisão não encontrado.');
    }

    const quality = dto.quality ?? 3;
    const interval = this.nextInterval(item.intervalDays, item.easeFactor.toString(), quality);
    const nextDue = new Date(Date.now() + interval.days * 24 * 60 * 60 * 1000);

    const updated = await this.prisma.reviewItem.update({
      where: { id: item.id },
      data: {
        intervalDays: interval.days,
        easeFactor: interval.easeFactor,
        repetitions: item.repetitions + 1,
        lapses: quality < 3 ? item.lapses + 1 : item.lapses,
        lastReviewedAt: new Date(),
        dueAt: nextDue,
      },
    });

    return {
      item: {
        id: updated.id,
        dueAt: updated.dueAt,
        intervalDays: updated.intervalDays,
        repetitions: updated.repetitions,
      },
    };
  }

  private nextInterval(intervalDays: number, easeFactor: string, quality: number) {
    let ef = Number(easeFactor);
    if (quality < 3) {
      return { days: 1, easeFactor: ef.toFixed(2) };
    }
    if (intervalDays < 6) {
      const days = intervalDays === 1 ? 3 : intervalDays === 3 ? 7 : intervalDays === 7 ? 14 : Math.max(1, intervalDays);
      ef = ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
      if (ef < 1.3) ef = 1.3;
      return { days, easeFactor: ef.toFixed(2) };
    }
    ef = ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (ef < 1.3) ef = 1.3;
    const days = Math.max(1, Math.round(intervalDays * ef));
    return { days, easeFactor: ef.toFixed(2) };
  }
