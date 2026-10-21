import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApplication } from '../src/common/configure-application.js';
import { PasswordService } from '../src/modules/auth/password.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const jwtSecret = 'admin-lifecycle-secret-at-least-32-characters';

describe('admin user management (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let passwords: PasswordService;
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

  async function authenticatedUser(role: 'ADMIN' | 'USER') {
    const password = 'private admin lifecycle password!';
    const user = await prisma.user.create({
      data: {
        name: `${role} lifecycle`,
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
    return { user, token, password };
  }

  async function createInvitedTarget() {
    const invitee = await prisma.user.create({
      data: {
        name: 'Invited Target',
        email: `target.${randomUUID()}@example.com`,
        role: 'USER',
        status: 'INVITED',
      },
    });
    createdUserIds.push(invitee.id);
    const rawToken = randomBytes(32).toString('base64url');
    await prisma.accountActivation.create({
      data: {
        userId: invitee.id,
        tokenHash: createHash('sha256').update(rawToken).digest('hex'),
        expiresAt: new Date(Date.now() + 3_600_000),
      },
    });
    return { invitee, rawToken };
  }

  it('lists only sanitized accounts and hides password hashes', async () => {
    const { token } = await authenticatedUser('ADMIN');
    const { invitee } = await createInvitedTarget();

    const response = await request(app.getHttpServer())
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${token}`)
      .expect('Cache-Control', 'private, no-store')
      .expect(200);

    const ids = (response.body.users as Array<{ id: string }>).map((entry) => entry.id);
    expect(ids).toContain(invitee.id);
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
  });

  it('updates name and role and records an audit trail', async () => {
    const { user: admin, token } = await authenticatedUser('ADMIN');
    const { invitee } = await createInvitedTarget();

    const response = await request(app.getHttpServer())
      .patch(`/api/admin/users/${invitee.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Renamed Target', role: 'USER' })
      .expect(200);

    expect(response.body.user).toMatchObject({ id: invitee.id, name: 'Renamed Target' });
    await expect(
      prisma.auditLog.count({
        where: { actorUserId: admin.id, targetUserId: invitee.id, action: 'USER_UPDATED' },
      }),
    ).resolves.toBe(1);
  });

  it('blocks an account, revokes its sessions, and audits the change', async () => {
    const { user: admin, token } = await authenticatedUser('ADMIN');
    const { invitee, rawToken } = await createInvitedTarget();

    await request(app.getHttpServer())
      .post('/api/auth/activate')
      .send({ token: rawToken, password: 'activated private password 2026!' })
      .expect(200);
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: invitee.email, password: 'activated private password 2026!' })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/admin/users/${invitee.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'BLOCKED' })
      .expect(200);

    const blocked = await prisma.user.findUniqueOrThrow({ where: { id: invitee.id } });
    expect(blocked.status).toBe('BLOCKED');
    await expect(
      prisma.authSession.count({ where: { userId: invitee.id, revokedAt: null } }),
    ).resolves.toBe(0);
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: invitee.email, password: 'activated private password 2026!' })
      .expect(401);
    await expect(
      prisma.auditLog.count({
        where: { actorUserId: admin.id, targetUserId: invitee.id, action: 'USER_STATUS_CHANGED' },
      }),
    ).resolves.toBe(1);
  });

  it('resets access with a fresh one-time activation link and revokes sessions', async () => {
    const { user: admin, token } = await authenticatedUser('ADMIN');
    const { invitee, rawToken } = await createInvitedTarget();

    await request(app.getHttpServer())
      .post('/api/auth/activate')
      .send({ token: rawToken, password: 'first private password 2026!' })
      .expect(200);
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: invitee.email, password: 'first private password 2026!' })
      .expect(200);

    const reset = await request(app.getHttpServer())
      .post(`/api/admin/users/${invitee.id}/reset-access`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    const resetUrl = new URL(reset.body.activationUrl as string);
    const newRawToken = resetUrl.searchParams.get('token');
    expect(newRawToken).toHaveLength(43);
    expect(reset.body.user).toMatchObject({ id: invitee.id, status: 'INVITED' });
    await expect(
      prisma.authSession.count({ where: { userId: invitee.id, revokedAt: null } }),
    ).resolves.toBe(0);
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(401);
    await expect(
      prisma.auditLog.count({
        where: { actorUserId: admin.id, targetUserId: invitee.id, action: 'USER_ACCESS_RESET' },
      }),
    ).resolves.toBe(1);

    await request(app.getHttpServer())
      .post('/api/auth/activate')
      .send({ token: newRawToken, password: 'second private password 2026!' })
      .expect(200);
  });

  it('forbids USER and anonymous callers from every admin mutation', async () => {
    const { token } = await authenticatedUser('USER');
    const { invitee } = await createInvitedTarget();

    await request(app.getHttpServer())
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/api/admin/users/${invitee.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'BLOCKED' })
      .expect(403);
    await request(app.getHttpServer())
      .post(`/api/admin/users/${invitee.id}/reset-access`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/admin/users')
      .expect(401);
  });

  it('returns 404 without leaking existence when the target does not exist', async () => {
    const { token } = await authenticatedUser('ADMIN');

    await request(app.getHttpServer())
      .patch(`/api/admin/users/${randomUUID()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'BLOCKED' })
      .expect(404);
  });
});
