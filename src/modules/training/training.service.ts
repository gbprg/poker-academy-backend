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

  async listPresets(userId: string) {
    const presets = await this.prisma.trainingPreset.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
    return { presets };
  }

  async createPreset(userId: string, dto: CreateTrainingPresetDto) {
    const preset = await this.prisma.trainingPreset.create({
      data: {
        userId,
        name: dto.name.trim(),
        filters: (dto.filters ?? {}) as never,
        scenario: (dto.scenario ?? {}) as never,
      },
    });
    return { preset };
  }

  async updatePreset(userId: string, presetId: string, dto: UpdateTrainingPresetDto) {
    const preset = await this.prisma.trainingPreset.updateMany({
      where: { id: presetId, userId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.filters !== undefined ? { filters: dto.filters as never } : {}),
        ...(dto.scenario !== undefined ? { scenario: dto.scenario as never } : {}),
      },
    });
    if (preset.count === 0) {
      throw new NotFoundException('Preset de treino não encontrado.');
    }
    const updated = await this.prisma.trainingPreset.findFirst({
      where: { id: presetId, userId },
    });
    return { preset: updated };
  }

  async deletePreset(userId: string, presetId: string) {
    const preset = await this.prisma.trainingPreset.deleteMany({
      where: { id: presetId, userId },
    });
    if (preset.count === 0) {
      throw new NotFoundException('Preset de treino não encontrado.');
    }
    return { deleted: true };
  }
