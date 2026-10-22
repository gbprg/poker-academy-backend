import { ForbiddenException, Injectable } from '@nestjs/common';
import { CoverageRepository } from './coverage.repository.js';
import type { CoverageQueryDto, CoverageStatusValue } from './coverage.dto.js';

const PUBLIC_STATUSES: CoverageStatusValue[] = ['PUBLISHED'];

export interface CoverageResponse {
  available: boolean;
  total: number;
  page: number;
  pageSize: number;
  query: {
    format: string;
    valuation: string;
    street: string;
    tableSize: number;
    status: CoverageStatusValue;
    sourceId: string | null;
  };
  items: Awaited<ReturnType<CoverageRepository['findExact']>>['items'];
}

@Injectable()
export class CoverageService {
  constructor(private readonly repository: CoverageRepository) {}

  async query(
    query: CoverageQueryDto,
    actor: { id: string; role: 'ADMIN' | 'USER' },
  ): Promise<CoverageResponse> {
    const status = query.status ?? 'PUBLISHED';
    if (!PUBLIC_STATUSES.includes(status) && actor.role !== 'ADMIN') {
      throw new ForbiddenException('Only administrators can query non-published coverage');
    }

    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 50));

    const { items, total } = await this.repository.findExact({
      format: query.format,
      valuation: query.valuation,
      street: query.street,
      tableSize: query.tableSize,
      status,
      sourceId: query.sourceId,
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return {
      available: total > 0,
      total,
      page,
      pageSize,
      query: {
        format: query.format,
        valuation: query.valuation,
        street: query.street,
        tableSize: query.tableSize,
        status,
        sourceId: query.sourceId ?? null,
      },
      items,
    };
  }
}
