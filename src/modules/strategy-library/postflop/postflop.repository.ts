import { Inject, Injectable } from '@nestjs/common';
import type { PrismaClient } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../prisma/prisma.service.js';

@Injectable()
export class PostflopRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaClient) {}

  async listPublishedTrees(filters: { format: string; valuation: string; street: string; tableSize: number }) {
    const spots = await this.prisma.spotDefinition.findMany({
      where: {
        format: filters.format as never,
        valuation: filters.valuation as never,
        street: filters.street as never,
        tableSize: filters.tableSize,
        versions: { some: { status: 'PUBLISHED' } },
      },
      select: {
        id: true,
        spotKey: true,
        street: true,
        board: true,
      },
    });

    const results = [];
    for (const spot of spots) {
      const version = await this.prisma.strategyVersion.findFirst({
        where: { spotId: spot.id, status: 'PUBLISHED' },
        select: { id: true, versionTag: true, sourceId: true },
      });
      if (!version) continue;
      const nodeCount = await this.prisma.strategyNode.count({ where: { strategyVersionId: version.id } });
      results.push({ spot, version, nodeCount });
    }
    return results;
  }

  async getPublishedNode(nodeId: string) {
    const node = await this.prisma.strategyNode.findFirst({
      where: { nodeKey: nodeId },
      select: {
        id: true,
        nodeKey: true,
        strategyVersionId: true,
        actions: {
          select: {
            id: true,
            handClass: true,
            actionType: true,
            sizing: true,
            frequency: true,
            evNullable: true,
            unitNullable: true,
          },
          orderBy: { handClass: 'asc' },
        },
      },
    });
    if (!node) return null;
    const version = await this.prisma.strategyVersion.findUnique({
      where: { id: node.strategyVersionId },
      select: {
        id: true,
        status: true,
        spotId: true,
        spot: { select: { id: true, spotKey: true, street: true, board: true } },
      },
    });
    if (!version || version.status !== 'PUBLISHED') return null;
    return { ...node, version };
  }
}
