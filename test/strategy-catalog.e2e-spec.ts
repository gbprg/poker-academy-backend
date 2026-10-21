import { createHash, randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';
import { StrategicSourcesService } from '../src/modules/strategy-library/strategic-sources.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

describe('strategy catalog constraints and provenance gate (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sources: StrategicSourcesService;
  const createdSourceIds: string[] = [];
  const createdSpotIds: string[] = [];
  const createdVersionIds: string[] = [];
  const createdUserIds: string[] = [];
  let adminId: string;

  beforeAll(async () => {
    process.env.DATABASE_URL ??=
      'postgresql://poker_academy:poker_academy_local@localhost:55432/poker_academy?schema=public';
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    sources = app.get(StrategicSourcesService);

    const admin = await prisma.user.create({
      data: {
        name: 'Catalog admin',
        email: `catalog.${randomUUID()}@example.com`,
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });
    adminId = admin.id;
    createdUserIds.push(admin.id);
  });

  afterAll(async () => {
    await prisma.strategyAction.deleteMany({
      where: { node: { strategyVersionId: { in: createdVersionIds } } },
    });
    await prisma.strategyNode.deleteMany({ where: { strategyVersionId: { in: createdVersionIds } } });
    await prisma.strategyVersion.deleteMany({ where: { id: { in: createdVersionIds } } });
    await prisma.spotDefinition.deleteMany({ where: { id: { in: createdSpotIds } } });
    await prisma.sourceLicense.deleteMany({ where: { sourceId: { in: createdSourceIds } } });
    await prisma.strategySource.deleteMany({ where: { id: { in: createdSourceIds } } });
    await prisma.auditLog.deleteMany({ where: { actorUserId: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await app.close();
  });

  async function seedSource(method: 'LICENSED' | 'DEMO_NOT_GTO') {
    const source = await prisma.strategySource.create({
      data: {
        slug: `src-${randomUUID().slice(0, 8)}`,
        title: 'Seeded source',
        author: 'Internal',
        method,
      },
    });
    createdSourceIds.push(source.id);
    return source;
  }

  async function seedSpot(fingerprint = sha256(randomUUID())) {
    const spot = await prisma.spotDefinition.create({
      data: {
        spotKey: `spot-${randomUUID().slice(0, 8)}`,
        canonicalFingerprint: fingerprint,
        format: 'MTT',
        valuation: 'CHIP_EV',
        street: 'PREFLOP',
        tableSize: 9,
        schemaVersion: '1.0.0',
        definition: { demoLabel: 'DEMO_NOT_GTO' },
      },
    });
    createdSpotIds.push(spot.id);
    return spot;
  }

  async function seedVersion(sourceId: string, spotId: string, evidence: object | null = null) {
    const version = await prisma.strategyVersion.create({
      data: {
        spotId,
        sourceId,
        versionTag: `v-${randomUUID().slice(0, 8)}`,
        model: 'CHIP_EV',
        checksum: sha256(randomUUID()),
        validationEvidence: evidence ?? undefined,
      },
    });
    createdVersionIds.push(version.id);
    return version;
  }

  it('enforces a unique canonical fingerprint on spots', async () => {
    const fingerprint = sha256(`fixed-fingerprint-${randomUUID()}`);
    await seedSpot(fingerprint);
    await expect(seedSpot(fingerprint)).rejects.toMatchObject({ code: 'P2002' });
  });

  it('enforces unique checksum on strategy versions', async () => {
    const source = await seedSource('LICENSED');
    const spot = await seedSpot();
    const checksum = sha256(`fixed-checksum-${randomUUID()}`);
    const created = await prisma.strategyVersion.create({
      data: { spotId: spot.id, sourceId: source.id, versionTag: 'v1', model: 'CHIP_EV', checksum },
    });
    createdVersionIds.push(created.id);
    await expect(
      prisma.strategyVersion.create({
        data: { spotId: spot.id, sourceId: source.id, versionTag: 'v2', model: 'CHIP_EV', checksum },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('blocks DEMO_NOT_GTO content from leaving DRAFT', async () => {
    const source = await seedSource('DEMO_NOT_GTO');
    const spot = await seedSpot();
    const version = await seedVersion(source.id, spot.id, { note: 'synthetic' });
    await expect(sources.assertCanAdvanceToReview(version.id)).rejects.toThrow(/DEMO_NOT_GTO/);
  });

  it('requires verified rights before REVIEW', async () => {
    const source = await seedSource('LICENSED');
    const spot = await seedSpot();
    const version = await seedVersion(source.id, spot.id, { note: 'validated offline' });
    await expect(sources.assertCanAdvanceToReview(version.id)).rejects.toThrow(/rights/);

    await prisma.sourceLicense.create({
      data: {
        sourceId: source.id,
        licenseName: 'Owned',
        terms: 'Internal',
        checksum: sha256(randomUUID()),
        capturedAt: new Date(),
      },
    });
    await sources.verifyRights(adminId, source.id);
    await expect(sources.assertCanAdvanceToReview(version.id)).resolves.toBeUndefined();
  });

  it('requires validation evidence before REVIEW', async () => {
    const source = await seedSource('LICENSED');
    const spot = await seedSpot();
    const version = await seedVersion(source.id, spot.id, null);
    await prisma.sourceLicense.create({
      data: {
        sourceId: source.id,
        licenseName: 'Owned',
        terms: 'Internal',
        checksum: sha256(randomUUID()),
        capturedAt: new Date(),
      },
    });
    await sources.verifyRights(adminId, source.id);
    await expect(sources.assertCanAdvanceToReview(version.id)).rejects.toThrow(/evidence/);
  });

  it('preserves historical versions by restricting source deletion', async () => {
    const source = await seedSource('LICENSED');
    const spot = await seedSpot();
    const version = await seedVersion(source.id, spot.id, { note: 'x' });
    expect(version.id).toBeDefined();
    await expect(
      prisma.strategySource.delete({ where: { id: source.id } }),
    ).rejects.toMatchObject({ code: 'P2003' });
  });
});
