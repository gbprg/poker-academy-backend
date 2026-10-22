import { Inject, Injectable } from '@nestjs/common';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { validateBundle, type ImportBundle, type ImportReport } from './importer.js';
import { computeSpotFingerprint } from '../strategy/contract/schemas.js';

export interface PersistResult extends ImportReport {
  created: { spots: number; versions: number; nodes: number; actions: number };
  skipped: { spots: number; versions: number };
}

export class ImportConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImportConflictError';
  }
}

@Injectable()
export class StrategyCatalogImporter {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaClient) {}

  /** Validates a bundle without touching the database (dry-run). */
  dryRun(raw: string): ImportReport {
    return validateBundle(raw);
  }

  /**
   * Validates and persists a bundle as DRAFT content inside a single transaction.
   * Existing spots/versions (matched by fingerprint/checksum) are skipped to keep imports idempotent.
   */
  async persist(raw: string, options: { sourceId: string }): Promise<PersistResult> {
    const report = validateBundle(raw);
    const created = { spots: 0, versions: 0, nodes: 0, actions: 0 };
    const skipped = { spots: 0, versions: 0 };
    if (!report.ok) {
      return { ...report, created, skipped };
    }

    const bundle = JSON.parse(raw) as ImportBundle;

    return this.prisma.$transaction(async (tx) => {
      for (const spot of bundle.spots) {
        const fingerprint = spot.canonicalFingerprint ?? computeSpotFingerprint(spot);
        const existing = await tx.spotDefinition.findUnique({
          where: { canonicalFingerprint: fingerprint },
          select: { id: true, spotKey: true },
        });
        if (existing) {
          if (existing.spotKey !== spot.spotId) {
            throw new ImportConflictError(
              `Fingerprint ${fingerprint} already exists with a different spotKey`,
            );
          }
          skipped.spots += 1;
          continue;
        }
        await tx.spotDefinition.create({
          data: {
            spotKey: spot.spotId,
            canonicalFingerprint: fingerprint,
            format: spot.format,
            valuation: spot.valuation,
            street: spot.street,
            tableSize: spot.tableSize,
            schemaVersion: spot.schemaVersion,
            definition: spot as unknown as object,
          },
        });
        created.spots += 1;
      }

      for (const version of bundle.strategyVersions) {
        const existing = await tx.strategyVersion.findUnique({
          where: { checksum: version.checksum },
          select: { id: true },
        });
        if (existing) {
          skipped.versions += 1;
          continue;
        }
        const spot = await tx.spotDefinition.findUnique({
          where: { spotKey: version.spotId },
          select: { id: true },
        });
        if (!spot) {
          throw new ImportConflictError(`spotId ${version.spotId} was not persisted`);
        }
        const persisted = await tx.strategyVersion.create({
          data: {
            spotId: spot.id,
            sourceId: options.sourceId,
            versionTag: version.versionTag,
            status: 'DRAFT',
            model: version.model,
            checksum: version.checksum,
            validationEvidence: version.validationEvidence as unknown as object,
          },
          select: { id: true },
        });
        created.versions += 1;

        for (const node of bundle.decisionNodes.filter(
          (candidate) => candidate.strategyVersionId === version.strategyVersionId,
        )) {
          const persistedNode = await tx.strategyNode.create({
            data: {
              strategyVersionId: persisted.id,
              nodeKey: node.nodeId,
              actions: {
                create: node.actions.map((action) => ({
                  handClass: action.combo,
                  actionType: action.actionType,
                  sizing: action.sizing ?? null,
                  frequency: action.frequency,
                  evNullable: action.evNullable ?? null,
                  unitNullable: action.unitNullable ?? null,
                })),
              },
            },
            select: { id: true, actions: { select: { id: true } } },
          });
          created.nodes += 1;
          created.actions += persistedNode.actions.length;
        }
      }

      return {
        ...report,
        created,
        skipped,
      };
    });
  }
}
