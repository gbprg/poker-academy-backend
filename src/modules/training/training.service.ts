import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { EligibleCountDto } from './training.dto.js';

@Injectable()
export class TrainingService {
  constructor(private readonly prisma: PrismaService) {}

  async eligibleCount(dto: EligibleCountDto) {
    const where = {
      status: 'PUBLISHED' as const,
      ...(dto.strategyVersionId ? { id: dto.strategyVersionId } : {}),
      ...(dto.spotId ? { spotId: dto.spotId } : {}),
      ...(dto.filters?.format ? { spot: { format: dto.filters.format as never } } : {}),
      ...(dto.filters?.valuation ? { model: dto.filters.valuation as never } : {}),
      ...(dto.filters?.street ? { spot: { street: dto.filters.street as never } } : {}),
      ...(dto.filters?.tableSize ? { spot: { tableSize: Number(dto.filters.tableSize) } } : {}),
    };

    const count = await this.prisma.strategyVersion.count({ where });
    return { eligible: count, count };
  }
}
