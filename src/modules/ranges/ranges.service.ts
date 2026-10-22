import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { RangesRepository } from './ranges.repository.js';
import type { PreflopRangeQueryDto } from './ranges.dto.js';

@Injectable()
export class RangesService {
  constructor(private readonly repository: RangesRepository) {}

  async getPreflopRange(query: PreflopRangeQueryDto) {
    // Zero-data is explicit: no fallback, no similar spot suggestion.
    const result = await this.repository.findPublishedPreflopSpot({
      format: query.format,
      valuation: query.valuation,
      street: query.street,
      tableSize: Number(query.tableSize),
    });

    if (!result) {
      // Keep it explicit and non-guessing per product rules (no invented ranges).
      throw new UnprocessableEntityException(
        'Nenhum range publicado encontrado para os filtros exatos informados.',
      );
    }

    const { spot, version, nodes } = result;

    // Build a compact, deterministic payload for the matrix (13x13 compatible).
    return {
      query: {
        format: query.format,
        valuation: query.valuation,
        street: query.street,
        tableSize: query.tableSize,
        position: query.position ?? null,
        vsPosition: query.vsPosition ?? null,
        scenario: query.scenario ?? null,
      },
      spot: {
        id: spot.id,
        spotKey: spot.spotKey,
        format: spot.format,
        valuation: spot.valuation,
        street: spot.street,
        tableSize: spot.tableSize,
      },
      version: {
        id: version.id,
        versionTag: version.versionTag,
        model: version.model,
        checksum: version.checksum,
        publishedAt: version.publishedAt,
        source: version.source,
      },
      nodes: nodes.map((node) => ({
        nodeKey: node.nodeKey,
        actions: node.actions.map((action) => ({
          handClass: action.handClass,
          actionType: action.actionType,
          sizing: action.sizing,
          frequency: action.frequency,
          evNullable: action.evNullable,
          unitNullable: action.unitNullable,
        })),
      })),
    };
  }
}
