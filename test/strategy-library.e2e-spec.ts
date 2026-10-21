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

const jwtSecret = 'strategy-library-secret-at-least-32-characters';

describe('strategy library sources (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let passwords: PasswordService;
  const createdUserIds: string[] = [];
  const createdSourceIds: string[] = [];

  const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

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
    await prisma.sourceLicense.deleteMany({ where: { sourceId: { in: createdSourceIds } } });
    await prisma.strategySource.deleteMany({ where: { id: { in: createdSourceIds } } });
    await prisma.auditLog.deleteMany({
      where: { OR: [{ actorUserId: { in: createdUserIds } }] },
    });
    await prisma.authSession.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.accountActivation.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await app.close();
  });

  async function authenticatedUser(role: 'ADMIN' | 'USER') {
    const password = 'private strategy library password!';
    const user = await prisma.user.create({
      data: {
        name: `${role} strategies`,
        email: `${role.toLowerCase()}.${randomUUID()}@example.com`,
        passwordHash: await passwords.hash(password),
        passwordChangedAt: new Date(),
        role,
        status: 'ACTIVE',
      },
    });
    createdUserIds.push(user.id);
    const jti = randomUUID();
    const issuedAt = new Date();
    await prisma.authSession.create({
      data: {
        userId: user.id,
        jti,
        issuedAt,
        expiresAt: new Date(issuedAt.getTime() + 15 * 60_000),
      },
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

  function sourcePayload() {
    return {
      slug: `source-${randomUUID().slice(0, 8)}`,
      title: 'Synthetic source',
      author: 'Internal',
      method: 'DEMO_NOT_GTO',
    };
  }

  async function createSource(token: string) {
    const response = await request(app.getHttpServer())
      .post('/api/admin/sources')
      .set('Authorization', `Bearer ${token}`)
      .send(sourcePayload())
      .expect(201);
    createdSourceIds.push(response.body.source.id);
    return response.body.source;
  }

  it('rejects anonymous access with 401', async () => {
    await request(app.getHttpServer()).get('/api/admin/sources').expect(401);
  });

  it('rejects USER role with 403', async () => {
    const { token } = await authenticatedUser('USER');
    await request(app.getHttpServer())
      .get('/api/admin/sources')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('creates a DRAFT source as ADMIN with rights unverified', async () => {
    const { token } = await authenticatedUser('ADMIN');
    const source = await createSource(token);
    expect(source).toMatchObject({ method: 'DEMO_NOT_GTO', rightsVerified: false });
  });

  it('rejects a duplicate slug with 409', async () => {
    const { token } = await authenticatedUser('ADMIN');
    const payload = sourcePayload();
    const first = await request(app.getHttpServer())
      .post('/api/admin/sources')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)
      .expect(201);
    createdSourceIds.push(first.body.source.id);

    await request(app.getHttpServer())
      .post('/api/admin/sources')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)
      .expect(409);
  });

  it('registers a license and rejects a duplicate checksum', async () => {
    const { token } = await authenticatedUser('ADMIN');
    const source = await createSource(token);
    const checksum = sha256(`license-${randomUUID()}`);

    await request(app.getHttpServer())
      .post(`/api/admin/sources/${source.id}/licenses`)
      .set('Authorization', `Bearer ${token}`)
      .send({ licenseName: 'CC0', terms: 'Public domain dedication', checksum })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/admin/sources/${source.id}/licenses`)
      .set('Authorization', `Bearer ${token}`)
      .send({ licenseName: 'CC0', terms: 'Public domain dedication', checksum })
      .expect(409);
  });

  it('cannot verify rights without a license, then succeeds after one is added', async () => {
    const { token } = await authenticatedUser('ADMIN');
    const source = await createSource(token);

    await request(app.getHttpServer())
      .post(`/api/admin/sources/${source.id}/verify-rights`)
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/admin/sources/${source.id}/licenses`)
      .set('Authorization', `Bearer ${token}`)
      .send({ licenseName: 'Owned', terms: 'Internal authorization', checksum: sha256(randomUUID()) })
      .expect(201);

    const verified = await request(app.getHttpServer())
      .post(`/api/admin/sources/${source.id}/verify-rights`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    expect(verified.body.source.rightsVerified).toBe(true);
  });

  it('lists sources with pagination metadata and a private cache header', async () => {
    const { token } = await authenticatedUser('ADMIN');
    await createSource(token);
    await createSource(token);

    const response = await request(app.getHttpServer())
      .get('/api/admin/sources?page=1&pageSize=1')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.pageSize).toBe(1);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.total).toBeGreaterThanOrEqual(2);
    expect(response.headers['cache-control']).toBe('private, no-store');
  });
});
