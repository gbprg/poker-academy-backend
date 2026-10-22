import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { StrategySourceRepository } from './strategy-source.repository.js';
import type { CreateLicenseDto, CreateSourceDto } from './source.dto.js';

const MAX_PAGE_SIZE = 100;

@Injectable()
export class StrategicSourcesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaClient,
    private readonly sources: StrategySourceRepository,
  ) {}

  async createSource(actorUserId: string, input: CreateSourceDto) {
    try {
      const source = await this.sources.create(input);
      await this.audit(actorUserId, 'STRATEGY_SOURCE_CREATED', source.id, {
        method: source.method,
      });
      return { source };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Source slug already exists');
      }
      throw error;
    }
  }

  async listSources(query: { page?: number; pageSize?: number; method?: CreateSourceDto['method'] }) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? 20));
    const { items, total } = await this.sources.list({
      skip: (page - 1) * pageSize,
      take: pageSize,
      method: query.method,
    });
    return { items, total, page, pageSize };
  }

  async addLicense(actorUserId: string, sourceId: string, input: CreateLicenseDto) {
    const source = await this.sources.findById(sourceId);
    if (!source) throw new NotFoundException('Source not found');

    try {
      const license = await this.sources.addLicense({
        sourceId,
        licenseName: input.licenseName,
        licenseUrl: input.licenseUrl,
        terms: input.terms,
        authorizationId: input.authorizationId,
        checksum: input.checksum,
      });
      await this.audit(actorUserId, 'STRATEGY_SOURCE_LICENSE_ADDED', sourceId, {
        checksum: input.checksum,
      });
      return { license };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('License checksum already registered for this source');
      }
      throw error;
    }
  }

  async verifyRights(actorUserId: string, sourceId: string) {
    const source = await this.sources.findById(sourceId);
    if (!source) throw new NotFoundException('Source not found');
    const licenseCount = await this.sources.countLicenses(sourceId);
    if (licenseCount === 0) {
      throw new BadRequestException('Cannot verify rights without at least one license');
    }
    const updated = await this.sources.markRightsVerified(sourceId);
    await this.audit(actorUserId, 'STRATEGY_SOURCE_RIGHTS_VERIFIED', sourceId, {
      licenses: licenseCount,
    });
    return { source: updated };
  }

  async assertCanAdvanceToReview(strategyVersionId: string): Promise<void> {
    const version = await this.prisma.strategyVersion.findUnique({
      where: { id: strategyVersionId },
      select: {
        source: { select: { method: true, rightsVerified: true } },
        validationEvidence: true,
      },
    });
    if (!version) throw new NotFoundException('Strategy version not found');

    if (version.source.method === 'DEMO_NOT_GTO') {
      throw new BadRequestException('DEMO_NOT_GTO content can never leave DRAFT');
    }
    if (!version.source.rightsVerified) {
      throw new BadRequestException('Source rights must be verified before REVIEW');
    }
    if (!version.validationEvidence) {
      throw new BadRequestException('Validation evidence is required before REVIEW');
    }
  }

  /** Publishing demands the same dual evidence as REVIEW: verified rights plus quality evidence. */
  async assertCanPublish(strategyVersionId: string): Promise<void> {
    await this.assertCanAdvanceToReview(strategyVersionId);
  }

  private async audit(
    actorUserId: string,
    action: string,
    targetId: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: { actorUserId, action, metadata: { targetId, ...metadata } },
    });
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'P2002'
  );
}
