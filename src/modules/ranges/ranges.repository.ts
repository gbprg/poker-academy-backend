import { Inject, Injectable } from '@nestjs/common';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class RangesRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaClient) {}

  async findPublishedPreflopSpot(filters: {
    format: string;
    valuation: string;
    street: string;
    tableSize: number | string;
  }) {
    const spot = await this.prisma.spotDefinition.findFirst({
      where: {
        format: filters.format as never,
        valuation: filters.valuation as never,
        street: filters.street as never,
        tableSize: Number(filters.tableSize),
        versions: {
          some: {
            status: 'PUBLISHED',
          },
        },
      },
      select: {
        id: true,
        spotKey: true,
        format: true,
        valuation: true,
        street: true,
        tableSize: true,
        definition: true,
      },
    });

    if (!spot) {
      return null;
    }

    const version = await this.prisma.strategyVersion.findFirst({
      where: {
        spotId: spot.id,
        status: 'PUBLISHED',
      },
      orderBy: { publishedAt: 'desc' },
      select: {
        id: true,
        versionTag: true,
        model: true,
        checksum: true,
        publishedAt: true,
        sourceId: true,
        source: {
          select: {
            id: true,
            slug: true,
            title: true,
            author: true,
            method: true,
            rightsVerified: true,
          },
        },
      },
    });

    if (!version) {
      return null;
    }

    const nodes = await this.prisma.strategyNode.findMany({
      where: {
        strategyVersionId: version.id,
      },
      select: {
        id: true,
        nodeKey: true,
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
      orderBy: { nodeKey: 'asc' },
    });

    return { spot, version, nodes };
  }
}
