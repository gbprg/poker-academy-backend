import { createHash } from 'node:crypto';
import type {
  DecisionNode,
  SpotDefinition,
  StrategyVersion,
} from '../strategy/contract/schemas.js';
import {
  decisionNodeSchema,
  spotDefinitionSchema,
  strategyVersionSchema,
  computeSpotFingerprint,
} from '../strategy/contract/schemas.js';
import { CONTRACT_SCHEMA_VERSION } from '../strategy/contract/enums.js';
import { validateSpot, type SpotInput } from '../poker-domain/spot-validator.js';

export const MAX_BUNDLE_BYTES = 5 * 1024 * 1024;

export interface ImportBundle {
  schemaVersion: string;
  source: {
    slug: string;
    title: string;
    author: string;
    method: 'SOLVER_VERIFIED' | 'LICENSED' | 'EDITORIAL' | 'DEMO_NOT_GTO';
    originUrl?: string;
  };
  spots: SpotDefinition[];
  strategyVersions: StrategyVersion[];
  decisionNodes: DecisionNode[];
}

export interface ImportIssue {
  path: string;
  code: string;
  message: string;
}

export interface ImportReport {
  ok: boolean;
  source?: { slug: string; method: string };
  counts: { spots: number; strategyVersions: number; decisionNodes: number };
  issues: ImportIssue[];
}

const bundleEnvelopeSchema = {
  parse(value: unknown): ImportBundle {
    if (typeof value !== 'object' || value === null) {
      throw new Error('bundle must be a JSON object');
    }
    const record = value as Record<string, unknown>;
    if (typeof record.schemaVersion !== 'string') throw new Error('schemaVersion is required');
    if (record.schemaVersion !== CONTRACT_SCHEMA_VERSION) {
      throw new Error(`Unsupported schemaVersion ${String(record.schemaVersion)}`);
    }
    if (typeof record.source !== 'object' || record.source === null) {
      throw new Error('source is required');
    }
    if (!Array.isArray(record.spots)) throw new Error('spots must be an array');
    if (!Array.isArray(record.strategyVersions)) throw new Error('strategyVersions must be an array');
    if (!Array.isArray(record.decisionNodes)) throw new Error('decisionNodes must be an array');
    return record as unknown as ImportBundle;
  },
};

export function estimateBundleBytes(raw: string): number {
  return Buffer.byteLength(raw, 'utf8');
}

function toSpotInput(spot: SpotDefinition): SpotInput {
  const preflop = spot.history.find((entry) => entry.street === 'PREFLOP');
  const isRfi =
    spot.street === 'PREFLOP' &&
    (preflop?.actions ?? []).every(
      (action) => action.action === 'FOLD' || action.action === 'CHECK',
    );
  return {
    street: spot.street,
    seats: spot.seats.map((seat) => ({
      seat: seat.seat,
      position: seat.position,
      stack: seat.stack.chips,
      isHero: seat.isHero,
    })),
    board: spot.board,
    heroHoleCards: spot.hero.holeCards,
    history: spot.history.map((entry) => ({
      street: entry.street,
      actions: entry.actions.map((action) => ({
        seat: action.seat,
        action: action.action,
        amountTo: action.amountTo,
        increment: action.increment,
      })),
    })),
    pot: { chips: spot.pot.chips, chipsAtStreetStart: spot.pot.chipsAtStreetStart },
    isRfi,
  };
}

export function validateBundle(raw: string): ImportReport {
  const issues: ImportIssue[] = [];
  const counts = { spots: 0, strategyVersions: 0, decisionNodes: 0 };

  let bundle: ImportBundle;
  try {
    bundle = bundleEnvelopeSchema.parse(JSON.parse(raw));
  } catch (error) {
    return {
      ok: false,
      counts,
      issues: [{ path: '$', code: 'MALFORMED_BUNDLE', message: (error as Error).message }],
    };
  }

  const spotIds = new Set<string>();
  const fingerprints = new Set<string>();

  for (const [index, spotRaw] of bundle.spots.entries()) {
    const rawId = (spotRaw as { spotId?: unknown })?.spotId;
    if (typeof rawId === 'string') {
      if (spotIds.has(rawId)) {
        issues.push({ path: `spots[${index}]`, code: 'DUPLICATE_SPOT_ID', message: `Duplicate spotId ${rawId}` });
      }
      spotIds.add(rawId);
    }
    const parsed = spotDefinitionSchema.safeParse(spotRaw);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        issues.push({
          path: `spots[${index}].${issue.path.join('.')}`,
          code: 'INVALID_SPOT',
          message: issue.message,
        });
      }
      continue;
    }
    const spot = parsed.data;

    const fingerprint = computeSpotFingerprint(spot);
    if (fingerprints.has(fingerprint)) {
      issues.push({ path: `spots[${index}]`, code: 'DUPLICATE_FINGERPRINT', message: `Duplicate fingerprint ${fingerprint}` });
    }
    fingerprints.add(fingerprint);

    for (const issue of validateSpot(toSpotInput(spot))) {
      issues.push({ path: `spots[${index}].${issue.path}`, code: issue.code, message: issue.message });
    }
    counts.spots += 1;
  }

  const versionIds = new Set<string>();
  const checksums = new Set<string>();
  for (const [index, versionRaw] of bundle.strategyVersions.entries()) {
    const parsed = strategyVersionSchema.safeParse(versionRaw);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        issues.push({
          path: `strategyVersions[${index}].${issue.path.join('.')}`,
          code: 'INVALID_VERSION',
          message: issue.message,
        });
      }
      continue;
    }
    const version = parsed.data;
    if (!spotIds.has(version.spotId)) {
      issues.push({
        path: `strategyVersions[${index}]`,
        code: 'ORPHAN_VERSION',
        message: `spotId ${version.spotId} is not present in the bundle`,
      });
    }
    if (versionIds.has(version.strategyVersionId)) {
      issues.push({ path: `strategyVersions[${index}]`, code: 'DUPLICATE_VERSION_ID', message: 'Duplicate strategyVersionId' });
    }
    versionIds.add(version.strategyVersionId);
    if (checksums.has(version.checksum)) {
      issues.push({ path: `strategyVersions[${index}]`, code: 'DUPLICATE_CHECKSUM', message: 'Duplicate checksum' });
    }
    checksums.add(version.checksum);
    counts.strategyVersions += 1;
  }

  for (const [index, nodeRaw] of bundle.decisionNodes.entries()) {
    const parsed = decisionNodeSchema.safeParse(nodeRaw);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        issues.push({
          path: `decisionNodes[${index}].${issue.path.join('.')}`,
          code: 'INVALID_NODE',
          message: issue.message,
        });
      }
      continue;
    }
    const node = parsed.data;
    if (!versionIds.has(node.strategyVersionId)) {
      issues.push({
        path: `decisionNodes[${index}]`,
        code: 'ORPHAN_NODE',
        message: `strategyVersionId ${node.strategyVersionId} is not present in the bundle`,
      });
    }
    counts.decisionNodes += 1;
  }

  validatePostflopCoherence(bundle, issues);

  return {
    ok: issues.length === 0,
    source: { slug: bundle.source.slug, method: bundle.source.method },
    counts,
    issues,
  };
}

export function checksumOf(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export { bundleEnvelopeSchema };

export function validatePostflopCoherence(bundle: ImportBundle, issues: ImportIssue[]): void {
  for (const [index, spot] of bundle.spots.entries()) {
    if (spot.street === 'FLOP') {
      if (!Array.isArray(spot.board) || spot.board.length !== 3) {
        issues.push({
          path: `spots[${index}].board`,
          code: 'INVALID_BOARD',
          message: 'FLOP requires exactly 3 board cards',
        });
      }
    }
    if (spot.street === 'TURN') {
      if (!Array.isArray(spot.board) || spot.board.length !== 4) {
        issues.push({
          path: `spots[${index}].board`,
          code: 'INVALID_BOARD',
          message: 'TURN requires exactly 4 board cards',
        });
      }
    }
    if (spot.street === 'RIVER') {
      if (!Array.isArray(spot.board) || spot.board.length !== 5) {
        issues.push({
          path: `spots[${index}].board`,
          code: 'INVALID_BOARD',
          message: 'RIVER requires exactly 5 board cards',
        });
      }
    }
  }
}
