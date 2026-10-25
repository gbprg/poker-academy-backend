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
    const spotByVersion = new Map(versions.map((version) => [version.id, version.spot]));

    const eligible = items.filter((item) => published.has(item.strategyVersionId));

    return {
      count: eligible.length,
      items: eligible.map((item) => ({
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
