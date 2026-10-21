import { Inject, Injectable } from '@nestjs/common';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';

export type SourceMethod = 'SOLVER_VERIFIED' | 'LICENSED' | 'EDITORIAL' | 'DEMO_NOT_GTO';

export interface SourceListParams {
  skip: number;
  take: number;
  method?: SourceMethod;
}

const sourceSelect = {
  id: true,
  slug: true,
  title: true,
  author: true,
  originUrl: true,
  method: true,
  rightsVerified: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class StrategySourceRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaClient) {}

  async create(input: {
    slug: string;
    title: string;
    author: string;
    originUrl?: string;
    method: SourceMethod;
  }) {
    return this.prisma.strategySource.create({
      data: {
        slug: input.slug,
        title: input.title.trim(),
        author: input.author.trim(),
        originUrl: input.originUrl?.trim(),
        method: input.method,
      },
      select: sourceSelect,
    });
  }

  async findById(id: string) {
    return this.prisma.strategySource.findUnique({
      where: { id },
      select: { ...sourceSelect, licenses: { select: { id: true } } },
    });
  }

  async list(params: SourceListParams) {
    const where = params.method ? { method: params.method } : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.strategySource.findMany({
        where,
        select: sourceSelect,
        orderBy: { createdAt: 'desc' },
        skip: params.skip,
        take: params.take,
      }),
      this.prisma.strategySource.count({ where }),
    ]);
    return { items, total };
  }

  async addLicense(input: {
    sourceId: string;
    licenseName: string;
    licenseUrl?: string;
    terms: string;
    authorizationId?: string;
    checksum: string;
  }) {
    return this.prisma.sourceLicense.create({
      data: {
        sourceId: input.sourceId,
        licenseName: input.licenseName,
        licenseUrl: input.licenseUrl,
        terms: input.terms,
        authorizationId: input.authorizationId,
        checksum: input.checksum,
        capturedAt: new Date(),
      },
      select: { id: true, sourceId: true, licenseName: true, checksum: true, capturedAt: true },
    });
  }

  async countLicenses(sourceId: string) {
    return this.prisma.sourceLicense.count({ where: { sourceId } });
  }

  async markRightsVerified(sourceId: string) {
    return this.prisma.strategySource.update({
      where: { id: sourceId },
      data: { rightsVerified: true },
      select: sourceSelect,
    });
  }
}
