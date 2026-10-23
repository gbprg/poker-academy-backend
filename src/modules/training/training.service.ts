import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { CreateTrainingSessionDto } from './training.dto.js';

@Injectable()
export class TrainingService {
  constructor(private readonly prisma: PrismaService) {}

  async createSession(userId: string, dto: CreateTrainingSessionDto) {
    // Find eligible published exercises: prefer strategyVersionId, else spotId, else any published version
    const versions = await this.prisma.strategyVersion.findMany({
      where: {
        status: 'PUBLISHED',
        ...(dto.strategyVersionId ? { id: dto.strategyVersionId } : {}),
        ...(dto.spotId ? { spotId: dto.spotId } : {}),
      },
      take: 50,
      orderBy: { publishedAt: 'desc' },
      select: { id: true, spotId: true },
    });

    if (versions.length === 0) {
      throw new UnprocessableEntityException('NO_ELIGIBLE_EXERCISES');
    }

    // Deterministic selection + snapshot
    const selected = versions[0];
    const sessionId = `ses-${selected.id.slice(0, 8)}-${Date.now().toString(36)}`;
    return {
      session: {
        id: sessionId,
        userId,
        spotId: selected.spotId,
        strategyVersionId: selected.id,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        snapshot: { filters: dto.filters ?? {}, scenario: dto.scenario ?? {} },
      },
    };
  }
}
