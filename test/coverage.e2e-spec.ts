import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApplication } from '../src/common/configure-application.js';
import { PasswordService } from '../src/modules/auth/password.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const jwtSecret = 'coverage-secret-at-least-32-characters-long';

describe('coverage api (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let passwords: PasswordService;
  const createdUserIds: string[] = [];
  const createdCoverageIds: string[] = [];
  const createdSpotIds: string[] = [];

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

    const spot = await prisma.spotDefinition.create({
      data: {
        spotKey: `coverage-spot-${randomUUID().slice(0, 8)}`,
        canonicalFingerprint: randomUUID().replace(/-/g, '').padEnd(64, '0').slice(0, 64),
        format: 'MTT',
        valuation: 'CHIP_EV',
        street: 'PREFLOP',
        tableSize: 9,
        schemaVersion: '1.0.0',
        definition: { demoLabel: 'DEMO_NOT_GTO' },
      },
    });
    createdSpotIds.push(spot.id);

    const now = Date.now();
    const rows = [
      { format: 'MTT', valuation: 'CHIP_EV', street: 'PREFLOP', tableSize: 9, status: 'PUBLISHED', eligibleExerciseCount: 5, updatedAt: new Date(now) },
      { format: 'MTT', valuation: 'CHIP_EV', street: 'PREFLOP', tableSize: 9, status: 'PUBLISHED', eligibleExerciseCount: 3, updatedAt: new Date(now - 1000), spotId: spot.id },
      { format: 'MTT', valuation: 'CHIP_EV', street: 'PREFLOP', tableSize: 9, status: 'DRAFT', eligibleExerciseCount: 1, updatedAt: new Date(now - 2000) },
      { format: 'MTT', valuation: 'CHIP_EV', street: 'FLOP', tableSize: 9, status: 'PUBLISHED', eligibleExerciseCount: 2, updatedAt: new Date(now - 3000) },
      { format: 'MTT', valuation: 'CHIP_EV', street: 'PREFLOP', tableSize: 6, status: 'PUBLISHED', eligibleExerciseCount: 7, updatedAt: new Date(now - 4000) },
      { format: 'SNG', valuation: 'ICM', street: 'PREFLOP', tableSize: 9, status: 'PUBLISHED', eligibleExerciseCount: 4, updatedAt: new Date(now - 5000) },
    ] as const;

    for (const row of rows) {
      const record = await prisma.coverageRecord.create({
        data: {
          format: row.format,
          valuation: row.valuation,
          street: row.street,
          tableSize: row.tableSize,
          status: row.status,
          eligibleExerciseCount: row.eligibleExerciseCount,
          updatedAt: row.updatedAt,
          ...('spotId' in row ? { spotId: row.spotId } : {}),
        },
      });
      createdCoverageIds.push(record.id);
    }
  });

  afterAll(async () => {
    await prisma.coverageRecord.deleteMany({ where: { id: { in: createdCoverageIds } } });
    await prisma.spotDefinition.deleteMany({ where: { id: { in: createdSpotIds } } });
    await prisma.auditLog.deleteMany({ where: { actorUserId: { in: createdUserIds } } });
    await prisma.authSession.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await app.close();
  });

  async function authenticatedUser(role: 'ADMIN' | 'USER') {
    const user = await prisma.user.create({
      data: {
        name: `${role} coverage`,
        email: `${role.toLowerCase()}.${randomUUID()}@example.com`,
        passwordHash: await passwords.hash('private coverage password!'),
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
    const token = new JwtService().sign(
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
    return { user, token };
  }

  const exactQuery = 'format=MTT&valuation=CHIP_EV&street=PREFLOP&tableSize=9';

  it('rejects unauthenticated requests', async () => {
    await request(app.getHttpServer()).get(`/api/coverage?${exactQuery}`).expect(401);
  });

  it('returns exact matches only, never a similar fallback', async () => {
    const { token } = await authenticatedUser('USER');
    const response = await request(app.getHttpServer())
      .get(`/api/coverage?${exactQuery}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.available).toBe(true);
    expect(response.body.total).toBe(2);
    for (const item of response.body.items) {
      expect(item).toMatchObject({ street: 'PREFLOP', tableSize: 9, status: 'PUBLISHED' });
    }
  });

  it('returns a clear zero-data state without substituting another tuple', async () => {
    const { token } = await authenticatedUser('USER');
    const response = await request(app.getHttpServer())
      .get('/api/coverage?format=MTT&valuation=CHIP_EV&street=TURN&tableSize=9')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toMatchObject({ available: false, total: 0, items: [] });
    expect(response.body.query).toMatchObject({ street: 'TURN', tableSize: 9 });
  });

  it('excludes non-published statuses by default', async () => {
    const { token } = await authenticatedUser('USER');
    const response = await request(app.getHttpServer())
      .get(`/api/coverage?${exactQuery}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(response.body.items.every((item: { status: string }) => item.status === 'PUBLISHED')).toBe(true);
  });

  it('forbids non-admins from querying draft coverage', async () => {
    const { token } = await authenticatedUser('USER');
    await request(app.getHttpServer())
      .get(`/api/coverage?${exactQuery}&status=DRAFT`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('allows admins to query draft coverage', async () => {
    const { token } = await authenticatedUser('ADMIN');
    const response = await request(app.getHttpServer())
      .get(`/api/coverage?${exactQuery}&status=DRAFT`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(response.body.total).toBe(1);
    expect(response.body.items[0].status).toBe('DRAFT');
  });

  it('paginates results', async () => {
    const { token } = await authenticatedUser('USER');
    const response = await request(app.getHttpServer())
      .get(`/api/coverage?${exactQuery}&pageSize=1&page=2`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(response.body.total).toBe(2);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.page).toBe(2);
    expect(response.body.pageSize).toBe(1);
  });

  it('sets a private no-store cache header', async () => {
    const { token } = await authenticatedUser('USER');
    const response = await request(app.getHttpServer())
      .get(`/api/coverage?${exactQuery}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(response.headers['cache-control']).toBe('private, no-store');
  });

  it('rejects requests missing required filters', async () => {
    const { token } = await authenticatedUser('USER');
    await request(app.getHttpServer())
      .get('/api/coverage?format=MTT')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });

  it('rejects unknown query parameters', async () => {
    const { token } = await authenticatedUser('USER');
    await request(app.getHttpServer())
      .get(`/api/coverage?${exactQuery}&foo=bar`)
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });
});
