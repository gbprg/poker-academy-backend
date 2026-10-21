import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { decisionNodeSchema, spotDefinitionSchema, strategyVersionSchema } from './schemas.js';
import { computeSpotFingerprint } from './schemas.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, '..', '..', '..', '..', 'tests', 'fixtures', 'contracts');

function loadJson(...segments: string[]): unknown {
  return JSON.parse(readFileSync(join(fixturesDir, ...segments), 'utf8'));
}

function listFixtures(kind: 'valid' | 'invalid'): string[] {
  return readdirSync(join(fixturesDir, kind)).filter((name) => name.endsWith('.json'));
}

describe('strategy contract — valid fixtures', () => {
  it('validates every valid fixture against its schema', () => {
    for (const name of listFixtures('valid')) {
      const fixture = loadJson('valid', name);
      const schema = name.startsWith('spot-')
        ? spotDefinitionSchema
        : name.startsWith('decision-node-')
          ? decisionNodeSchema
          : strategyVersionSchema;
      const result = schema.safeParse(fixture);
      expect(result.success, `${name} should be valid: ${JSON.stringify(result.error?.issues)}`).toBe(true);
    }
  });

  it('labels every valid fixture with demoLabel DEMO_NOT_GTO', () => {
    for (const name of listFixtures('valid')) {
      expect(loadJson('valid', name)).toMatchObject({ demoLabel: 'DEMO_NOT_GTO' });
    }
  });
});

describe('strategy contract — invalid fixtures', () => {
  const expectations: Record<string, 'spot' | 'node'> = {
    'spot-duplicate-board.json': 'spot',
    'spot-board-length-wrong.json': 'spot',
    'spot-hero-board-collision.json': 'spot',
    'spot-icm-without-payout.json': 'spot',
    'spot-pko-without-bounty.json': 'spot',
    'node-frequency-out-of-tolerance.json': 'node',
    'node-illegal-call-sizing.json': 'node',
  };

  it.each(Object.entries(expectations))('rejects %s', (name, kind) => {
    const fixture = loadJson('invalid', name);
    const schema = kind === 'spot' ? spotDefinitionSchema : decisionNodeSchema;
    expect(schema.safeParse(fixture).success).toBe(false);
  });
});

describe('canonical fingerprint', () => {
  it('is deterministic regardless of object key order', () => {
    const spot = spotDefinitionSchema.parse(loadJson('valid', 'spot-preflop-rfi.json'));
    const reordered = Object.fromEntries(Object.entries(spot).reverse());
    expect(computeSpotFingerprint(reordered as typeof spot)).toBe(computeSpotFingerprint(spot));
  });

  it('changes when a meaningful field changes', () => {
    const spot = spotDefinitionSchema.parse(loadJson('valid', 'spot-preflop-rfi.json'));
    const changed = { ...spot, pot: { chips: spot.pot.chips + 0.5, chipsAtStreetStart: spot.pot.chipsAtStreetStart } };
    expect(computeSpotFingerprint(changed)).not.toBe(computeSpotFingerprint(spot));
  });
});
