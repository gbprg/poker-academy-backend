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

const jwtSecret = 'lifecycle-secret-at-least-32-characters-long';
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

describe('strategy lifecycle (e2e)', () => {
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
    await prisma.auditLog.deleteMany({ where: { actorUserId: { in: createdUserIds } } });
    await prisma.authSession.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await app.close();
  });

  async function authenticatedUser(role: 'ADMIN' | 'USER') {
    const user = await prisma.user.create({
      data: {
        name: `${role} lifecycle`,
        email: `${role.toLowerCase()}.${randomUUID()}@example.com`,
        passwordHash: await passwords.hash('private lifecycle password!'),
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

  async function seedVersion(options: { method: 'LICENSED' | 'DEMO_NOT_GTO'; rightsVerified: boolean; evidence: boolean }) {
    const source = await prisma.strategySource.create({
      data: {
        slug: `lifecycle-${randomUUID().slice(0, 8)}`,
        title: 'Lifecycle source',
        author: 'Internal',
        method: options.method,
        rightsVerified: options.rightsVerified,
      },
    });
    createdSourceIds.push(source.id);

    const spot = await prisma.spotDefinition.create({
      data: {
        spotKey: `lifecycle-spot-${randomUUID().slice(0, 8)}`,
        canonicalFingerprint: sha256(randomUUID()),
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
        checksum: sha256(randomUUID()),
        validationEvidence: options.evidence ? { note: 'reviewed offline' } : undefined,
      },
    });
    createdVersionIds.push(version.id);
    return version.id;
  }

  const transition = (token: string, id: string, body: Record<string, unknown>) =>
    request(app.getHttpServer())
      .post(`/api/admin/strategy-versions/${id}/transition`)
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  it('rejects unauthenticated requests', async () => {
    const id = await seedVersion({ method: 'LICENSED', rightsVerified: true, evidence: true });
    await request(app.getHttpServer())
      .post(`/api/admin/strategy-versions/${id}/transition`)
      .send({ to: 'REVIEW' })
      .expect(401);
  });

  it('forbids non-admins', async () => {
    const id = await seedVersion({ method: 'LICENSED', rightsVerified: true, evidence: true });
    const { token } = await authenticatedUser('USER');
    await transition(token, id, { to: 'REVIEW' }).expect(403);
  });

  it('publishes eligible content through DRAFT -> REVIEW -> PUBLISHED', async () => {
    const id = await seedVersion({ method: 'LICENSED', rightsVerified: true, evidence: true });
    const { token } = await authenticatedUser('ADMIN');

    await transition(token, id, { to: 'REVIEW' }).expect(201);
    const published = await transition(token, id, { to: 'PUBLISHED' }).expect(201);
    expect(published.body).toMatchObject({ from: 'REVIEW', to: 'PUBLISHED' });

    const stored = await prisma.strategyVersion.findUnique({ where: { id } });
    expect(stored?.status).toBe('PUBLISHED');
    expect(stored?.publishedAt).not.toBeNull();
  });

  it('rejects DEMO_NOT_GTO content with 422', async () => {
    const id = await seedVersion({ method: 'DEMO_NOT_GTO', rightsVerified: true, evidence: true });
    const { token } = await authenticatedUser('ADMIN');
    await transition(token, id, { to: 'REVIEW' }).expect(422);
  });

  it('rejects publishing without rights or evidence with 422', async () => {
    const noRights = await seedVersion({ method: 'LICENSED', rightsVerified: false, evidence: true });
    const noEvidence = await seedVersion({ method: 'LICENSED', rightsVerified: true, evidence: false });
    const { token } = await authenticatedUser('ADMIN');
    await transition(token, noRights, { to: 'REVIEW' }).expect(422);
    await transition(token, noEvidence, { to: 'REVIEW' }).expect(422);
  });

  it('rejects illegal transitions with 409', async () => {
    const id = await seedVersion({ method: 'LICENSED', rightsVerified: true, evidence: true });
    const { token } = await authenticatedUser('ADMIN');
    await transition(token, id, { to: 'PUBLISHED' }).expect(409);
  });

  it('requires a justification to deprecate', async () => {
    const id = await seedVersion({ method: 'LICENSED', rightsVerified: true, evidence: true });
    const { token } = await authenticatedUser('ADMIN');
    await transition(token, id, { to: 'REVIEW' }).expect(201);
    await transition(token, id, { to: 'PUBLISHED' }).expect(201);

    await transition(token, id, { to: 'DEPRECATED' }).expect(400);
    await transition(token, id, { to: 'DEPRECATED', justification: 'superseded by v2' }).expect(201);

    const stored = await prisma.strategyVersion.findUnique({ where: { id } });
    expect(stored?.status).toBe('DEPRECATED');
  });

  it('records an audit entry with reviewer context', async () => {
    const id = await seedVersion({ method: 'LICENSED', rightsVerified: true, evidence: true });
    const { user, token } = await authenticatedUser('ADMIN');
    await transition(token, id, { to: 'REVIEW', reviewerNote: 'looks correct' }).expect(201);

    const audit = await prisma.auditLog.findFirst({
      where: { actorUserId: user.id, action: 'STRATEGY_VERSION_REVIEW' },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit).not.toBeNull();
    expect(audit?.metadata).toMatchObject({ targetId: id, from: 'DRAFT', to: 'REVIEW' });
  });

  it('does not allow editing a published version in place', async () => {
    const id = await seedVersion({ method: 'LICENSED', rightsVerified: true, evidence: true });
    const { token } = await authenticatedUser('ADMIN');
    await transition(token, id, { to: 'REVIEW' }).expect(201);
    await transition(token, id, { to: 'PUBLISHED' }).expect(201);

    // A version already published must reject another in-place transition to an editable state.
    await transition(token, id, { to: 'DRAFT' }).expect(409);
  });

  it('surfaces a conflict when the status changes concurrently', async () => {
    const id = await seedVersion({ method: 'LICENSED', rightsVerified: true, evidence: true });
    const { token } = await authenticatedUser('ADMIN');

    const [first, second] = await Promise.all([
      transition(token, id, { to: 'REVIEW' }),
      transition(token, id, { to: 'REVIEW' }),
    ]);
    const statuses = [first.status, second.status].sort((a, b) => a - b);
    expect(statuses).toEqual([201, 409]);
  });
});
