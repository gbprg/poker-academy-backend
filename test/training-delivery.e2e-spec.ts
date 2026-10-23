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

const jwtSecret = 'training-delivery-secret-at-least-32-characters';

function collectKeys(value: unknown, acc: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, acc);
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      acc.push(key.toLowerCase());
      collectKeys(child, acc);
    }
  }
  return acc;
}

describe('training question delivery (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let passwords: PasswordService;
  const createdUserIds: string[] = [];
  const createdSessionIds: string[] = [];
  const createdVersionIds: string[] = [];
  const createdSpotIds: string[] = [];
  const createdSourceIds: string[] = [];
  let publishedSpotKey: string;

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

    const source = await prisma.strategySource.create({
      data: {
        slug: `training-source-${randomUUID().slice(0, 8)}`,
        title: 'Training fixture source',
        author: 'Poker Academy',
        method: 'LICENSED',
        rightsVerified: true,
      },
    });
    createdSourceIds.push(source.id);

    publishedSpotKey = `training-spot-${randomUUID().slice(0, 8)}`;
    const spot = await prisma.spotDefinition.create({
      data: {
        spotKey: publishedSpotKey,
        canonicalFingerprint: randomUUID().replace(/-/g, '').padEnd(64, '0').slice(0, 64),
        format: 'MTT',
        valuation: 'CHIP_EV',
        street: 'PREFLOP',
        tableSize: 9,
        schemaVersion: '1.0.0',
        definition: {
          blinds: { smallBlind: 0.5, bigBlind: 1, anteType: 'BB_ANTE', anteValue: 1 },
          seats: [{ seat: 7, position: 'BTN', stack: { chips: 20, bb: 20 }, isHero: true, isActive: true }],
          hero: { seat: 7, position: 'BTN', handClass: 'AA' },
          board: [],
          history: [{ street: 'PREFLOP', actions: [] }],
          pot: { chips: 2.5, chipsAtStreetStart: 1.5 },
          legalActions: ['FOLD', 'RAISE', 'ALL_IN'],
        },
      },
    });
    createdSpotIds.push(spot.id);

    const version = await prisma.strategyVersion.create({
      data: {
        spotId: spot.id,
        sourceId: source.id,
        versionTag: 'v1',
        status: 'PUBLISHED',
        model: 'CHIP_EV',
        checksum: randomUUID().replace(/-/g, '').padEnd(64, '0').slice(0, 64),
        publishedAt: new Date(),
        validationEvidence: ['fixture'],
      },
    });
    createdVersionIds.push(version.id);

    const node = await prisma.strategyNode.create({
      data: {
        strategyVersionId: version.id,
        nodeKey: 'RFI_BTN_20BB',
        actions: {
          create: [
            { handClass: 'AA', actionType: 'RAISE', sizing: 2, frequency: 1 },
            { handClass: 'AKs', actionType: 'FOLD', frequency: 0.25 },
          ],
        },
      },
    });

    expect(node.id).toBeTruthy();
  });

  afterAll(async () => {
    await prisma.trainingSession.deleteMany({ where: { id: { in: createdSessionIds } } });
    await prisma.strategyAction.deleteMany({ where: { node: { strategyVersionId: { in: createdVersionIds } } } });
    await prisma.strategyNode.deleteMany({ where: { strategyVersionId: { in: createdVersionIds } } });
    await prisma.strategyVersion.deleteMany({ where: { id: { in: createdVersionIds } } });
    await prisma.spotDefinition.deleteMany({ where: { id: { in: createdSpotIds } } });
    await prisma.strategySource.deleteMany({ where: { id: { in: createdSourceIds } } });
    await prisma.auditLog.deleteMany({ where: { actorUserId: { in: createdUserIds } } });
    await prisma.authSession.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await app.close();
  });

  async function authenticatedUser() {
    const user = await prisma.user.create({
      data: {
        name: 'Training user',
        email: `training.${randomUUID()}@example.com`,
        passwordHash: await passwords.hash('private training password!'),
        passwordChangedAt: new Date(),
        role: 'USER',
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

  async function createSession(token: string) {
    const response = await request(app.getHttpServer())
      .post('/api/training/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ spotId: createdSpotIds[0] })
      .expect(201);
    createdSessionIds.push(response.body.session.id);
    return response.body;
  }

  it('rejects unauthenticated requests', async () => {
    await request(app.getHttpServer()).post('/api/training/sessions').send({}).expect(401);
  });

  it('returns 422 when no published exercise matches the filters', async () => {
    const { token } = await authenticatedUser();
    const response = await request(app.getHttpServer())
      .post('/api/training/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ spotId: randomUUID() })
      .expect(422);
    expect(response.body.message).toBe('NO_ELIGIBLE_EXERCISES');
  });

  it('delivers context and legal actions without any strategy answer or EV', async () => {
    const { token } = await authenticatedUser();
    const body = await createSession(token);

    expect(body.question.context).toMatchObject({
      spotKey: publishedSpotKey,
      street: 'PREFLOP',
      nodeKey: 'RFI_BTN_20BB',
      legalActions: ['FOLD', 'RAISE', 'ALL_IN'],
    });

    const keys = collectKeys(body);
    for (const forbidden of ['evnullable', 'frequency', 'actiontype', 'strategyaction', 'answer', 'correctaction']) {
      expect(keys).not.toContain(forbidden);
    }
  });

  it('serves a question by position and enforces ownership', async () => {
    const owner = await authenticatedUser();
    const body = await createSession(owner.token);

    const ok = await request(app.getHttpServer())
      .get(`/api/training/sessions/${body.session.id}/questions/1`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    expect(ok.body.question.position).toBe(1);
    expect(ok.body.question.context).toMatchObject({ spotKey: publishedSpotKey });

    const stranger = await authenticatedUser();
    await request(app.getHttpServer())
      .get(`/api/training/sessions/${body.session.id}/questions/1`)
      .set('Authorization', `Bearer ${stranger.token}`)
      .expect(404);
  });

  it('rejects illegal actions and invalid sizings without persisting an attempt', async () => {
    const { token } = await authenticatedUser();
    const body = await createSession(token);

    await request(app.getHttpServer())
      .post(`/api/training/sessions/${body.session.id}/questions/1/answers`)
      .set('Authorization', `Bearer ${token}`)
      .send({ actionType: 'CALL', idempotencyKey: 'illegal-action-key' })
      .expect(422);

    await request(app.getHttpServer())
      .post(`/api/training/sessions/${body.session.id}/questions/1/answers`)
      .set('Authorization', `Bearer ${token}`)
      .send({ actionType: 'RAISE', sizing: 5, idempotencyKey: 'illegal-sizing-key' })
      .expect(422);
  });

  it('scores the chosen action against the server-side mix and keeps EV null', async () => {
    const { token } = await authenticatedUser();
    const body = await createSession(token);

    const response = await request(app.getHttpServer())
      .post(`/api/training/sessions/${body.session.id}/questions/1/answers`)
      .set('Authorization', `Bearer ${token}`)
      .send({ actionType: 'RAISE', sizing: 2, idempotencyKey: 'first-answer-key' })
      .expect(201);

    expect(response.body).toMatchObject({
      duplicate: false,
      score: 1,
      evDelta: null,
      bestActionType: 'RAISE',
      scoringVersion: 'mix-v1',
    });
    expect(response.body.mix).toEqual([{ actionType: 'RAISE', frequency: 1 }]);
  });

  it('returns the original result on a repeated answer without double scoring', async () => {
    const { token } = await authenticatedUser();
    const body = await createSession(token);

    const first = await request(app.getHttpServer())
      .post(`/api/training/sessions/${body.session.id}/questions/1/answers`)
      .set('Authorization', `Bearer ${token}`)
      .send({ actionType: 'RAISE', sizing: 2, idempotencyKey: 'repeat-key-0001' })
      .expect(201);

    const second = await request(app.getHttpServer())
      .post(`/api/training/sessions/${body.session.id}/questions/1/answers`)
      .set('Authorization', `Bearer ${token}`)
      .send({ actionType: 'RAISE', sizing: 2, idempotencyKey: 'repeat-key-0001' })
      .expect(201);

    expect(second.body.duplicate).toBe(true);
    expect(second.body.score).toBe(first.body.score);

    const differentKey = await request(app.getHttpServer())
      .post(`/api/training/sessions/${body.session.id}/questions/1/answers`)
      .set('Authorization', `Bearer ${token}`)
      .send({ actionType: 'RAISE', sizing: 2, idempotencyKey: 'repeat-key-0002' })
      .expect(201);
    expect(differentKey.body.duplicate).toBe(true);

    const attempts = await prisma.trainingAttempt.count({
      where: { question: { sessionId: body.session.id } },
    });
    expect(attempts).toBe(1);
  });

  it('forbids answering another user\'s question', async () => {
    const owner = await authenticatedUser();
    const body = await createSession(owner.token);
    const stranger = await authenticatedUser();

    await request(app.getHttpServer())
      .post(`/api/training/sessions/${body.session.id}/questions/1/answers`)
      .set('Authorization', `Bearer ${stranger.token}`)
      .send({ actionType: 'RAISE', sizing: 2, idempotencyKey: 'stranger-key-0001' })
      .expect(404);
  });

  it('completes a session once with aggregates derived from attempts', async () => {
    const { token } = await authenticatedUser();
    const body = await createSession(token);

    const partial = await request(app.getHttpServer())
      .post(`/api/training/sessions/${body.session.id}/complete`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    expect(partial.body).toMatchObject({
      totalQuestions: 1,
      answeredQuestions: 0,
      partial: true,
      averageScore: null,
      averageEvDelta: null,
    });
    expect(partial.body.session.alreadyCompleted).toBe(false);

    const completedAt = partial.body.session.completedAt;

    const again = await request(app.getHttpServer())
      .post(`/api/training/sessions/${body.session.id}/complete`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    expect(again.body.session.alreadyCompleted).toBe(true);
    expect(again.body.session.completedAt).toBe(completedAt);

    const session = await prisma.trainingSession.findUnique({ where: { id: body.session.id } });
    expect(session?.status).toBe('COMPLETED');
  });

  it('reports the scored answer and source/version on completion', async () => {
    const { token } = await authenticatedUser();
    const body = await createSession(token);

    await request(app.getHttpServer())
      .post(`/api/training/sessions/${body.session.id}/questions/1/answers`)
      .set('Authorization', `Bearer ${token}`)
      .send({ actionType: 'RAISE', sizing: 2, idempotencyKey: 'complete-key-0001' })
      .expect(201);

    const response = await request(app.getHttpServer())
      .post(`/api/training/sessions/${body.session.id}/complete`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    expect(response.body).toMatchObject({
      totalQuestions: 1,
      answeredQuestions: 1,
      partial: false,
      averageScore: 1,
      averageEvDelta: null,
    });
    expect(response.body.results[0]).toMatchObject({
      position: 1,
      spotKey: publishedSpotKey,
      answered: true,
      actionType: 'RAISE',
      score: 1,
      evDelta: null,
      scoringVersion: 'mix-v1',
    });
  });

  it('forbids completing or reading another user\'s session', async () => {
    const owner = await authenticatedUser();
    const body = await createSession(owner.token);
    const stranger = await authenticatedUser();

    await request(app.getHttpServer())
      .post(`/api/training/sessions/${body.session.id}/complete`)
      .set('Authorization', `Bearer ${stranger.token}`)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/training/sessions/${body.session.id}`)
      .set('Authorization', `Bearer ${stranger.token}`)
      .expect(404);
  });

  it('keeps history private and stable across sessions', async () => {
    const first = await authenticatedUser();
    const firstSession = await createSession(first.token);
    await request(app.getHttpServer())
      .post(`/api/training/sessions/${firstSession.session.id}/complete`)
      .set('Authorization', `Bearer ${first.token}`)
      .expect(201);

    const history = await request(app.getHttpServer())
      .get('/api/training/history')
      .set('Authorization', `Bearer ${first.token}`)
      .expect(200);
    expect(history.body.sessions).toHaveLength(1);
    expect(history.body.sessions[0]).toMatchObject({
      id: firstSession.session.id,
      status: 'COMPLETED',
      totalQuestions: 1,
    });

    const second = await authenticatedUser();
    const otherHistory = await request(app.getHttpServer())
      .get('/api/training/history')
      .set('Authorization', `Bearer ${second.token}`)
      .expect(200);
    expect(otherHistory.body.sessions).toHaveLength(0);
  });

  it('returns a session summary with answered flags', async () => {
    const { token } = await authenticatedUser();
    const body = await createSession(token);

    const response = await request(app.getHttpServer())
      .get(`/api/training/sessions/${body.session.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.session.id).toBe(body.session.id);
    expect(response.body.questions).toHaveLength(1);
    expect(response.body.questions[0]).toMatchObject({ position: 1, answered: false });
  });
});
