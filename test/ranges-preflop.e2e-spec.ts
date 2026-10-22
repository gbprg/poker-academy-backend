import { createHash, randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApplication } from '../src/common/configure-application.js';
import { PasswordService } from '../src/modules/auth/password.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const jwtSecret = 'ranges-secret-at-least-32-characters-long!!';

describe('ranges preflop (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let passwords: PasswordService;
  const createdUserIds: string[] = [];
  const createdSourceIds: string[] = [];
  const createdSpotIds: string[] = [];
  const createdVersionIds: string[] = [];

  beforeAll(async () => {
    process.env.JWT_SECRET = jwtSecret;
    process.env.JWT_ISSUER = 'poker-academy-api';
    process.env.JWT_AUDIENCE = 'poker-academy-frontend';
    process.env.FRONTEND_ORIGIN = 'http://localhost:5173';
    process.env.DATABASE_URL ??=
      'postgresql://poker_academy:poker_academy_local@localhost:55432/poker_academy?schema=public';

    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    configureApplication(app);
    await app.init();
    prisma = app.get(PrismaService);
    passwords = app.get(PasswordService);
  });

  afterAll(async () => {
    await prisma.strategyAction.deleteMany({
      where: { node: { strategyVersionId: { in: createdVersionIds } } },
    });
    await prisma.strategyNode.deleteMany({ where: { strategyVersionId: { in: createdVersionIds } } });
    await prisma.strategyVersion.deleteMany({ where: { id: { in: createdVersionIds } } });
    await prisma.coverageRecord.deleteMany({ where: { spotId: { in: createdSpotIds } } });
    await prisma.spotDefinition.deleteMany({ where: { id: { in: createdSpotIds } } });
    await prisma.sourceLicense.deleteMany({ where: { sourceId: { in: createdSourceIds } } });
    await prisma.strategySource.deleteMany({ where: { id: { in: createdSourceIds } } });
    await prisma.authSession.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await app.close();
  });

  async function tokenFor(role: 'ADMIN' | 'USER') {
    const user = await prisma.user.create({
      data: {
        name: `${role} ranges`,
        email: `${role.toLowerCase()}.${randomUUID()}@example.com`,
        passwordHash: await passwords.hash('private ranges password!'),
        passwordChangedAt: new Date(),
        role,
        status: 'ACTIVE',
      },
    });
    createdUserIds.push(user.id);
    const jti = randomUUID();
    const issuedAt = new Date();
    await prisma.authSession.create({
      data: { userId: user.id, jti, issuedAt, expiresAt: new Date(issuedAt.getTime() + 15 * 60_000) },
    });
    return new JwtService().sign(
      {},
      {
        secret: jwtSecret,
        algorithm: 'HS256',
        issuer: 'poker-academy-api',
        audience: 'poker-academy-frontend',
        subject: user.id,
        jwtid: jti,
        expiresIn: 900,
      },
    );
  }

  async function seedPublishedPreflop() {
    const source = await prisma.strategySource.create({
      data: {
        slug: `ranges-${randomUUID().slice(0, 8)}`,
        title: 'Ranges source',
        author: 'Internal',
        method: 'DEMO_NOT_GTO',
        rightsVerified: true,
      },
    });
    createdSourceIds.push(source.id);

    const spot = await prisma.spotDefinition.create({
      data: {
        spotKey: `ranges-spot-${randomUUID().slice(0, 8)}`,
        canonicalFingerprint: createHash('sha256').update(randomUUID()).digest('hex'),
        format: 'MTT',
        valuation: 'CHIP_EV',
        street: 'PREFLOP',
        tableSize: 9,
        schemaVersion: '1.0.0',
        definition: { demoLabel: 'DEMO_NOT_GTO' },
      },
    });
    createdSpotIds.push(spot.id);

    const version = await prisma.strategyVersion.create({
      data: {
        spotId: spot.id,
        sourceId: source.id,
        versionTag: `v-${randomUUID().slice(0, 8)}`,
        model: 'CHIP_EV',
        checksum: createHash('sha256').update(randomUUID()).digest('hex'),
        status: 'PUBLISHED',
        publishedAt: new Date(),
        validationEvidence: { note: 'published for tests' },
      },
    });
    createdVersionIds.push(version.id);

    const node = await prisma.strategyNode.create({
      data: {
        strategyVersionId: version.id,
        nodeKey: 'rfi',
        actions: {
          create: [
            { handClass: 'AA', actionType: 'RAISE', sizing: 2.5, frequency: 1.0 },
            { handClass: 'AKs', actionType: 'RAISE', sizing: 2.5, frequency: 0.5 },
            { handClass: 'AKo', actionType: 'FOLD', frequency: 1.0 },
          ],
        },
      },
    });

    return { spot, version, node };
  }

  it('requires authentication', async () => {
    await request(app.getHttpServer())
      .get('/api/ranges/preflop?format=MTT&valuation=CHIP_EV&street=PREFLOP&tableSize=9')
      .expect(401);
  });

  it('returns 422 with no fallback when no published range exists', async () => {
    const token = await tokenFor('USER');
    await request(app.getHttpServer())
      .get('/api/ranges/preflop?format=MTT&valuation=CHIP_EV&street=PREFLOP&tableSize=6')
      .set('Authorization', `Bearer ${token}`)
      .expect(422);
  });

  it('returns published range for authenticated user with exact filters', async () => {
    await seedPublishedPreflop();
    const token = await tokenFor('USER');
    const res = await request(app.getHttpServer())
      .get('/api/ranges/preflop?format=MTT&valuation=CHIP_EV&street=PREFLOP&tableSize=9')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.version.status).toBeUndefined();
    expect(res.body.spot.tableSize).toBe(9);
    expect(Array.isArray(res.body.nodes)).toBe(true);
    expect(res.body.nodes[0].actions).toHaveLength(3);
    expect(res.body.version.source.method).toBeDefined();
  });

  it('returns 200 for ADMIN too', async () => {
    await seedPublishedPreflop();
    const token = await tokenFor('ADMIN');
    const res = await request(app.getHttpServer())
      .get('/api/ranges/preflop?format=MTT&valuation=CHIP_EV&street=PREFLOP&tableSize=9')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.nodes.length).toBeGreaterThan(0);
  });
});
