import { Inject, Injectable } from '@nestjs/common';
import type { PrismaClient } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import type { CoverageStatusValue } from './coverage.dto.js';

export interface CoverageLookup {
  format: 'MTT' | 'SNG';
  valuation: 'CHIP_EV' | 'ICM' | 'PKO' | 'EDITORIAL';
  street: 'PREFLOP' | 'FLOP' | 'TURN' | 'RIVER';
  tableSize: number;
  status: CoverageStatusValue;
  sourceId?: string;
  skip: number;
  take: number;
}

export interface CoverageItem {
  id: string;
  format: string;
  valuation: string;
  street: string;
  tableSize: number;
  status: string;
  eligibleExerciseCount: number;
  updatedAt: Date;
  spotKey: string | null;
}

@Injectable()
export class CoverageRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaClient) {}

  async findExact(params: CoverageLookup): Promise<{ items: CoverageItem[]; total: number }> {
    const where = {
      format: params.format,
      valuation: params.valuation,
      street: params.street,
      tableSize: params.tableSize,
      status: params.status,
      ...(params.sourceId
        ? { spot: { versions: { some: { sourceId: params.sourceId } } } }
        : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.coverageRecord.findMany({
        where,
        select: {
          id: true,
          format: true,
          valuation: true,
          street: true,
          tableSize: true,
          status: true,
          eligibleExerciseCount: true,
          updatedAt: true,
          spot: { select: { spotKey: true } },
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        skip: params.skip,
        take: params.take,
      }),
      this.prisma.coverageRecord.count({ where }),
    ]);

    return {
      items: rows.map((row) => ({
        id: row.id,
        format: row.format,
        valuation: row.valuation,
        street: row.street,
        tableSize: row.tableSize,
        status: row.status,
        eligibleExerciseCount: row.eligibleExerciseCount,
        updatedAt: row.updatedAt,
        spotKey: row.spot?.spotKey ?? null,
      })),
      total,
    };
  }
}
