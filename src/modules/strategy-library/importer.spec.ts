import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { validateBundle } from './importer.js';

const fixturesDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../tests/fixtures/strategy');

const load = (name: string) => readFileSync(resolve(fixturesDir, name), 'utf8');

describe('validateBundle', () => {
  it('accepts a well-formed bundle and counts its contents', () => {
    const report = validateBundle(load('bundle-valid.json'));
    expect(report.ok).toBe(true);
    expect(report.issues).toHaveLength(0);
    expect(report.counts).toEqual({ spots: 1, strategyVersions: 1, decisionNodes: 1 });
    expect(report.source).toEqual({ slug: 'demo-synthetic', method: 'DEMO_NOT_GTO' });
  });

  it('rejects malformed JSON with a bundle-level issue', () => {
    const report = validateBundle('{ not json');
    expect(report.ok).toBe(false);
    expect(report.issues[0]).toMatchObject({ path: '$', code: 'MALFORMED_BUNDLE' });
  });

  it('rejects an unsupported schema version', () => {
    const report = validateBundle(JSON.stringify({ schemaVersion: '2.0.0' }));
    expect(report.ok).toBe(false);
    expect(report.issues[0].code).toBe('MALFORMED_BUNDLE');
  });

  it('reports duplicate spot ids, orphan versions and out-of-tolerance frequencies', () => {
    const report = validateBundle(load('bundle-invalid.json'));
    expect(report.ok).toBe(false);
    const codes = report.issues.map((issue) => issue.code);
    expect(codes).toContain('DUPLICATE_SPOT_ID');
    expect(codes).toContain('INVALID_SPOT');
    expect(codes).toContain('ORPHAN_NODE');
    expect(codes).toContain('INVALID_NODE');
  });

  it('collects multiple issues instead of failing on the first one', () => {
    const report = validateBundle(load('bundle-invalid.json'));
    expect(report.issues.length).toBeGreaterThan(1);
  });
});
