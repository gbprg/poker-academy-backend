import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { StrategicSourcesService } from './strategic-sources.service.js';
import { isEditable, validateTransition, type LifecycleStatus } from './lifecycle.js';

const STATUS_CONFLICT = 409;

export interface TransitionRequest {
  to: LifecycleStatus;
  justification?: string;
  reviewerNote?: string;
}

@Injectable()
export class StrategyLifecycleService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaClient,
    private readonly sources: StrategicSourcesService,
  ) {}

  async transition(actorUserId: string, versionId: string, request: TransitionRequest) {
    const version = await this.prisma.strategyVersion.findUnique({
      where: { id: versionId },
      select: { id: true, status: true, spotId: true, sourceId: true },
    });
    if (!version) throw new NotFoundException('Strategy version not found');

    const from = version.status as LifecycleStatus;
    const error = validateTransition({ from, to: request.to, justification: request.justification });
    if (error?.code === 'ILLEGAL_TRANSITION') {
      throw new ConflictException(`Cannot move version from ${from} to ${request.to}`);
    }
    if (error?.code === 'MISSING_JUSTIFICATION') {
      throw new BadRequestException(`A justification is required to move to ${request.to}`);
    }

    if (request.to === 'REVIEW' || request.to === 'PUBLISHED') {
      await this.assertEvidence(versionId, request.to);
    }

    const publishedAt = request.to === 'PUBLISHED' ? new Date() : undefined;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.strategyVersion.updateMany({
        where: { id: versionId, status: from },
        data: {
          status: request.to,
          ...(publishedAt ? { publishedAt } : {}),
        },
      });
      if (updated.count === 0) {
        throw new ConflictException('Version status changed concurrently; retry the transition');
      }

      await tx.auditLog.create({
        data: {
          actorUserId,
          action: `STRATEGY_VERSION_${request.to}`,
          metadata: {
            targetId: versionId,
            from,
            to: request.to,
            justification: request.justification ?? null,
            reviewerNote: request.reviewerNote ?? null,
          },
        },
      });

      return { id: versionId, from, to: request.to, publishedAt: publishedAt ?? null };
    });
  }

  async assertEditable(versionId: string): Promise<void> {
    const version = await this.prisma.strategyVersion.findUnique({
      where: { id: versionId },
      select: { status: true },
    });
    if (!version) throw new NotFoundException('Strategy version not found');
    if (!isEditable(version.status as LifecycleStatus)) {
      throw new ConflictException('Published versions are immutable; create a new version instead');
    }
  }

  /**
   * Enforces the dual evidence required to advance content: verified rights plus quality
   * evidence. Ineligible content surfaces as 422 so the caller can distinguish it from a
   * state-machine conflict (409).
   */
  private async assertEvidence(versionId: string, to: LifecycleStatus): Promise<void> {
    try {
      await this.sources.assertCanPublish(versionId);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw new UnprocessableEntityException(`${to} rejected: ${error.message}`);
      }
      throw error;
    }
  }

  get statusConflictCode(): number {
    return STATUS_CONFLICT;
  }
}
