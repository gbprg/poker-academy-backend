import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApplication } from '../src/common/configure-application.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const jwtSecret = 'test-only-secret-with-at-least-32-characters';

describe('admin user invitations (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const createdUserIds: string[] = [];

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
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { actorUserId: { in: createdUserIds } },
          { targetUserId: { in: createdUserIds } },
        ],
      },
    });
    await prisma.authSession.deleteMany({
      where: { userId: { in: createdUserIds } },
    });
    await prisma.accountActivation.deleteMany({
      where: { userId: { in: createdUserIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await app.close();
  });

  async function authenticatedUser(role: 'ADMIN' | 'USER') {
    const user = await prisma.user.create({
      data: {
        name: `${role} test`,
        email: `${role.toLowerCase()}.${randomUUID()}@example.com`,
        passwordHash: '$argon2id$test-placeholder',
        role,
        status: 'ACTIVE',
        passwordChangedAt: new Date(),
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

  it('allows ADMIN to issue a one-time private activation link', async () => {
    const { user: admin, token } = await authenticatedUser('ADMIN');
    const invitedEmail = `invited.${randomUUID()}@example.com`;

    const response = await request(app.getHttpServer())
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Invited User', email: invitedEmail })
      .expect(201);
    createdUserIds.push(response.body.user.id as string);

    expect(response.body.user).toMatchObject({
      email: invitedEmail,
      role: 'USER',
      status: 'INVITED',
    });
    expect(response.body.user).not.toHaveProperty('passwordHash');
    const activationUrl = new URL(response.body.activationUrl as string);
    const rawToken = activationUrl.searchParams.get('token');
    expect(rawToken).toHaveLength(43);

    const stored = await prisma.accountActivation.findFirstOrThrow({
      where: { userId: response.body.user.id as string },
    });
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: {
        actorUserId: admin.id,
        targetUserId: response.body.user.id as string,
      },
    });
    expect(stored.tokenHash).not.toContain(rawToken!);
    expect(JSON.stringify(audit)).not.toContain(rawToken!);

    const duplicate = await request(app.getHttpServer())
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Duplicate', email: invitedEmail.toUpperCase() })
      .expect(409);
    expect(JSON.stringify(duplicate.body)).not.toMatch(/Prisma|constraint|query/i);
  });

  it('returns 403 to USER without creating the requested account', async () => {
    const { token } = await authenticatedUser('USER');
    const rejectedEmail = `rejected.${randomUUID()}@example.com`;

    await request(app.getHttpServer())
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Must Not Exist', email: rejectedEmail })
      .expect(403);

    await expect(
      prisma.user.count({ where: { email: rejectedEmail } }),
    ).resolves.toBe(0);
  });

  it('keeps invitation and registration unavailable to anonymous visitors', async () => {
    await request(app.getHttpServer())
      .post('/api/admin/users')
      .send({ name: 'Anonymous', email: `anon.${randomUUID()}@example.com` })
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'public@example.com', password: 'not-allowed' })
      .expect(404);
  });
});
