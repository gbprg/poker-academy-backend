import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApplication } from '../src/common/configure-application.js';
import { PasswordService } from '../src/modules/auth/password.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const jwtSecret = 'import-preview-secret-at-least-32-chars!!';
const fixturesDir = resolve(dirname(fileURLToPath(import.meta.url)), '../tests/fixtures/strategy');
const load = (name: string) => readFileSync(resolve(fixturesDir, name), 'utf8');

describe('admin imports preview/commit (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let passwords: PasswordService;
  const createdUserIds: string[] = [];
  const createdSourceIds: string[] = [];
  const createdSpotIds: string[] = [];
  const createdVersionIds: string[] = [];

  const validBundle = load('bundle-valid.json');
  const invalidBundle = load('bundle-invalid.json');

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
        name: `${role} import`,
        email: `${role.toLowerCase()}.${randomUUID()}@example.com`,
        passwordHash: await passwords.hash('private import password!'),
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

  async function createSource() {
    const source = await prisma.strategySource.create({
      data: {
        slug: `import-preview-${randomUUID().slice(0, 8)}`,
        title: 'Import preview source',
        author: 'Internal',
        method: 'DEMO_NOT_GTO',
      },
    });
    createdSourceIds.push(source.id);
    return source.id;
  }

  it('rejects unauthenticated requests', async () => {
    const sourceId = await createSource();
    await request(app.getHttpServer())
      .post('/api/admin/imports/preview')
      .send({ sourceId, bundle: validBundle })
      .expect(401);
  });

  it('rejects USER role with 403', async () => {
    const sourceId = await createSource();
    const token = await tokenFor('USER');
    await request(app.getHttpServer())
      .post('/api/admin/imports/preview')
      .set('Authorization', `Bearer ${token}`)
      .send({ sourceId, bundle: validBundle })
      .expect(403);
  });

  it('preview validates without persisting and returns actionable errors for invalid bundles', async () => {
    const sourceId = await createSource();
    const token = await tokenFor('ADMIN');

    const res = await request(app.getHttpServer())
      .post('/api/admin/imports/preview')
      .set('Authorization', `Bearer ${token}`)
      .send({ sourceId, bundle: invalidBundle })
      .expect(201);

    expect(res.body.persisted).toBe(false);
    expect(res.body.report.ok).toBe(false);
    expect(Array.isArray(res.body.report.issues)).toBe(true);
    expect(res.body.report.issues.length).toBeGreaterThan(0);
    expect(res.body.report.issues[0]).toMatchObject({
      path: expect.any(String),
      code: expect.any(String),
      message: expect.any(String),
    });

    const count = await prisma.spotDefinition.count({ where: { spotKey: 'bundle-bad-flop' } });
    expect(count).toBe(0);
  });

  it('preview happy path returns ok without persisting', async () => {
    const sourceId = await createSource();
    const token = await tokenFor('ADMIN');

    const res = await request(app.getHttpServer())
      .post('/api/admin/imports/preview')
      .set('Authorization', `Bearer ${token}`)
      .send({ sourceId, bundle: validBundle })
      .expect(201);

    expect(res.body.persisted).toBe(false);
    expect(res.body.report.ok).toBe(true);
    expect(res.body.report.counts).toEqual({ spots: 1, strategyVersions: 1, decisionNodes: 1 });

    const count = await prisma.spotDefinition.count({
      where: { spotKey: 'bundle-rfi-btn-20bb-9max-mtt' },
    });
    expect(count).toBe(0);
  });

  it('commit persists a valid bundle as DRAFT and returns created counts', async () => {
    const sourceId = await createSource();
    const token = await tokenFor('ADMIN');

    const res = await request(app.getHttpServer())
      .post('/api/admin/imports/commit')
      .set('Authorization', `Bearer ${token}`)
      .send({ sourceId, bundle: validBundle })
      .expect(201);

    expect(res.body.persisted).toBe(true);
    expect(res.body.ok).toBe(true);
    expect(res.body.created).toEqual({ spots: 1, versions: 1, nodes: 1, actions: 3 });

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
    expect(version?.sourceId).toBe(sourceId);
    createdVersionIds.push(version!.id);
  });

  it('commit rejects invalid bundles without persisting', async () => {
    const sourceId = await createSource();
    const token = await tokenFor('ADMIN');

    const res = await request(app.getHttpServer())
      .post('/api/admin/imports/commit')
      .set('Authorization', `Bearer ${token}`)
      .send({ sourceId, bundle: invalidBundle })
      .expect(400);

    expect(res.body.message).toBe('Bundle failed validation and was not persisted');
    expect(res.body.report.ok).toBe(false);
    const count = await prisma.spotDefinition.count({ where: { spotKey: 'bundle-bad-flop' } });
    expect(count).toBe(0);
  });

  it('preview returns 404 for unknown sourceId', async () => {
    const token = await tokenFor('ADMIN');
    await request(app.getHttpServer())
      .post('/api/admin/imports/preview')
      .set('Authorization', `Bearer ${token}`)
      .send({ sourceId: randomUUID(), bundle: validBundle })
      .expect(404);
  });
});
