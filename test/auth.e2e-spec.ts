import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApplication } from '../src/common/configure-application.js';
import { PasswordService } from '../src/modules/auth/password.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const jwtSecret = 'auth-e2e-secret-with-at-least-32-characters';

describe('authentication lifecycle (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let passwords: PasswordService;
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    process.env.JWT_SECRET = jwtSecret;
    process.env.JWT_ISSUER = 'poker-academy-api';
    process.env.JWT_AUDIENCE = 'poker-academy-frontend';
    process.env.JWT_TTL_SECONDS = '900';
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
    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { actorUserId: { in: createdUserIds } },
          { targetUserId: { in: createdUserIds } },
        ],
      },
    });
    await prisma.authSession.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.accountActivation.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await app.close();
  });

  async function createInvitation() {
    const rawToken = randomBytes(32).toString('base64url');
    const user = await prisma.user.create({
      data: {
        name: 'Invited Player',
        email: `activation.${randomUUID()}@example.com`,
        role: 'USER',
        status: 'INVITED',
      },
    });
    createdUserIds.push(user.id);
    await prisma.accountActivation.create({
      data: {
        userId: user.id,
        tokenHash: createHash('sha256').update(rawToken).digest('hex'),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    return { user, rawToken };
  }

  async function createActiveUser(status: 'ACTIVE' | 'BLOCKED' = 'ACTIVE') {
    const password = 'private login password 2026!';
    const user = await prisma.user.create({
      data: {
        name: 'Active Player',
        email: `login.${randomUUID()}@example.com`,
        passwordHash: await passwords.hash(password),
        passwordChangedAt: new Date(),
        role: 'USER',
        status,
      },
    });
    createdUserIds.push(user.id);
    return { user, password };
  }

  it('activates one invitation exactly once and never returns its password hash', async () => {
    const { user, rawToken } = await createInvitation();

    const activated = await request(app.getHttpServer())
      .post('/api/auth/activate')
      .send({ token: rawToken, password: 'new private password 2026!' })
      .expect(200);

    expect(activated.body.user).toMatchObject({ id: user.id, status: 'ACTIVE' });
    expect(activated.body.user).not.toHaveProperty('passwordHash');
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.passwordHash).toMatch(/^\$argon2id\$/);

    await request(app.getHttpServer())
      .post('/api/auth/activate')
      .send({ token: rawToken, password: 'another private password!' })
      .expect(400);
  });

  it('allows only one winner when the same invitation is consumed concurrently', async () => {
    const { rawToken } = await createInvitation();
    const responses = await Promise.all([
      request(app.getHttpServer())
        .post('/api/auth/activate')
        .send({ token: rawToken, password: 'parallel password number one!' }),
      request(app.getHttpServer())
        .post('/api/auth/activate')
        .send({ token: rawToken, password: 'parallel password number two!' }),
    ]);

    expect(
      responses.map((response) => response.status).sort((a, b) => a - b),
    ).toEqual([200, 400]);
  });

  it('uses one uniform error for an unknown email, wrong password, and blocked account', async () => {
    const active = await createActiveUser();
    const blocked = await createActiveUser('BLOCKED');
    const attempts = [
      { email: `missing.${randomUUID()}@example.com`, password: active.password },
      { email: active.user.email, password: 'definitely wrong password' },
      { email: blocked.user.email, password: blocked.password },
    ];

    const responses = [];
    for (const body of attempts) {
      responses.push(
        await request(app.getHttpServer()).post('/api/auth/login').send(body).expect(401),
      );
    }
    expect(responses.map((response) => response.body)).toEqual([
      responses[0].body,
      responses[0].body,
      responses[0].body,
    ]);
  });

  it('rate limits repeated login attempts for the same IP and email', async () => {
    const body = {
      email: `bruteforce.${randomUUID()}@example.com`,
      password: 'wrong password',
    };

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(app.getHttpServer()).post('/api/auth/login').send(body).expect(401);
    }
    await request(app.getHttpServer()).post('/api/auth/login').send(body).expect(429);
  });

  it('logs in, exposes sanitized /me, and revokes the session on logout', async () => {
    const { user, password } = await createActiveUser();
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: user.email.toUpperCase(), password })
      .expect(200);

    expect(login.body.user).not.toHaveProperty('passwordHash');
    const decoded = new JwtService().decode(login.body.accessToken as string, {
      json: true,
    }) as Record<string, unknown>;
    expect(decoded).toMatchObject({
      iss: 'poker-academy-api',
      aud: 'poker-academy-frontend',
      sub: user.id,
    });
    expect(typeof decoded.jti).toBe('string');
    expect(Number(decoded.exp) - Number(decoded.iat)).toBe(900);

    const me = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect('Cache-Control', 'private, no-store')
      .expect(200);
    expect(me.body.user).toMatchObject({ id: user.id, email: user.email });
    expect(me.body.user).not.toHaveProperty('passwordHash');

    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(204);
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(401);
  });

  it('rate limits repeated activation attempts from the same IP', async () => {
    const body = {
      token: randomBytes(32).toString('base64url'),
      password: 'a private activation password!',
    };

    let blocked = false;
    for (let attempt = 0; attempt < 20 && !blocked; attempt += 1) {
      const response = await request(app.getHttpServer()).post('/api/auth/activate').send(body);
      if (response.status === 429) {
        blocked = true;
      } else {
        expect(response.status).toBe(400);
      }
    }
    expect(blocked).toBe(true);
  });
});
