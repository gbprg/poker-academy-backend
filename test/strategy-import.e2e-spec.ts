import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';
import { StrategyCatalogImporter, ImportConflictError } from '../src/modules/strategy-library/strategy-catalog.importer.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const fixturesDir = resolve(dirname(fileURLToPath(import.meta.url)), '../tests/fixtures/strategy');
const load = (name: string) => readFileSync(resolve(fixturesDir, name), 'utf8');

describe('strategy catalog import (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let importer: StrategyCatalogImporter;
  const createdSourceIds: string[] = [];
  const createdVersionIds: string[] = [];
  const createdSpotIds: string[] = [];
  let sourceId: string;

  const validBundle = load('bundle-valid.json');
  const invalidBundle = load('bundle-invalid.json');

  beforeAll(async () => {
    process.env.DATABASE_URL ??=
      'postgresql://poker_academy:poker_academy_local@localhost:55432/poker_academy?schema=public';
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    importer = app.get(StrategyCatalogImporter);

    const source = await prisma.strategySource.create({
      data: {
        slug: `import-${randomUUID().slice(0, 8)}`,
        title: 'Import source',
        author: 'Internal',
        method: 'DEMO_NOT_GTO',
      },
    });
    sourceId = source.id;
    createdSourceIds.push(source.id);
  });

  afterAll(async () => {
    await prisma.strategyAction.deleteMany({
      where: { node: { strategyVersionId: { in: createdVersionIds } } },
    });
    await prisma.strategyNode.deleteMany({ where: { strategyVersionId: { in: createdVersionIds } } });
    await prisma.strategyVersion.deleteMany({ where: { id: { in: createdVersionIds } } });
    if (createdSpotIds.length > 0) {
      await prisma.spotDefinition.deleteMany({ where: { id: { in: createdSpotIds } } });
    }
    await prisma.sourceLicense.deleteMany({ where: { sourceId: { in: createdSourceIds } } });
    await prisma.strategySource.deleteMany({ where: { id: { in: createdSourceIds } } });
    await app.close();
  });

  it('dry-run validates without persisting anything', async () => {
    const report = importer.dryRun(validBundle);
    expect(report.ok).toBe(true);
    const count = await prisma.spotDefinition.count({
      where: { spotKey: 'bundle-rfi-btn-20bb-9max-mtt' },
    });
    expect(count).toBe(0);
  });

  it('refuses to persist an invalid bundle', async () => {
    const result = await importer.persist(invalidBundle, { sourceId });
    expect(result.ok).toBe(false);
    expect(result.created).toEqual({ spots: 0, versions: 0, nodes: 0, actions: 0 });
    const count = await prisma.spotDefinition.count({ where: { spotKey: 'bundle-bad-flop' } });
    expect(count).toBe(0);
  });

  it('persists a valid bundle as DRAFT content', async () => {
    const result = await importer.persist(validBundle, { sourceId });
    expect(result.ok).toBe(true);
    expect(result.created).toEqual({ spots: 1, versions: 1, nodes: 1, actions: 3 });

    const spot = await prisma.spotDefinition.findUnique({
      where: { spotKey: 'bundle-rfi-btn-20bb-9max-mtt' },
    });
    expect(spot).not.toBeNull();
    createdSpotIds.push(spot!.id);

    const version = await prisma.strategyVersion.findFirst({
      where: { spotId: spot!.id },
      include: { nodes: { include: { actions: true } } },
    });
    expect(version?.status).toBe('DRAFT');
    expect(version?.nodes[0].actions).toHaveLength(3);
    createdVersionIds.push(version!.id);
  });

  it('is idempotent: a second import skips existing content', async () => {
    const result = await importer.persist(validBundle, { sourceId });
    expect(result.ok).toBe(true);
    expect(result.created).toEqual({ spots: 0, versions: 0, nodes: 0, actions: 0 });
    expect(result.skipped).toEqual({ spots: 1, versions: 1 });
  });

  it('rolls back on a mid-bundle conflict', async () => {
    const existing = await prisma.spotDefinition.findUnique({
      where: { spotKey: 'bundle-rfi-btn-20bb-9max-mtt' },
      select: { canonicalFingerprint: true },
    });
    const conflicting = JSON.parse(validBundle) as Record<string, unknown>;
    const spots = conflicting.spots as Array<Record<string, unknown>>;
    const versions = conflicting.strategyVersions as Array<Record<string, unknown>>;
    const nodes = conflicting.decisionNodes as Array<Record<string, unknown>>;
    const newKey = 'bundle-rfi-btn-20bb-DIFFERENT-KEY';
    spots[0] = {
      ...spots[0],
      spotId: newKey,
      canonicalFingerprint: existing!.canonicalFingerprint,
    };
    versions[0] = { ...versions[0], spotId: newKey };
    nodes[0] = { ...nodes[0], spotId: newKey };
    await expect(importer.persist(JSON.stringify(conflicting), { sourceId })).rejects.toBeInstanceOf(
      ImportConflictError,
    );
  });
});
