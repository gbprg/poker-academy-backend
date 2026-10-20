import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { AdminUsersService } from '../src/modules/administration/users/admin-users.service.js';
import { PasswordService } from '../src/modules/auth/password.service.js';
import { BootstrapAdminService } from '../src/modules/identity/bootstrap-admin.service.js';

const databaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://poker_academy:poker_academy_local@localhost:55432/poker_academy?schema=public';

describe('private account provisioning', () => {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
  const passwords = new PasswordService();
  const bootstrap = new BootstrapAdminService(prisma, passwords);
  const adminUsers = new AdminUsersService(prisma);
  const createdUserIds: string[] = [];

  afterAll(async () => {
    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { actorUserId: { in: createdUserIds } },
          { targetUserId: { in: createdUserIds } },
        ],
      },
    });
    await prisma.accountActivation.deleteMany({
      where: { userId: { in: createdUserIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  });

  it('bootstraps one active ADMIN idempotently without returning its password hash', async () => {
    const email = `admin.${randomUUID()}@example.com`;
    const input = {
      name: 'Initial Admin',
      email,
      password: 'correct horse battery staple 2026!',
    };

    const first = await bootstrap.run(input);
    createdUserIds.push(first.id);
    const second = await bootstrap.run(input);
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: first.id } });

    expect(second.id).toBe(first.id);
    expect(first).toMatchObject({ role: 'ADMIN', status: 'ACTIVE' });
    expect(first).not.toHaveProperty('passwordHash');
    expect(stored.passwordHash).toMatch(/^\$argon2id\$/);
    await expect(passwords.verify(stored.passwordHash!, input.password)).resolves.toBe(true);
    await expect(
      prisma.user.count({ where: { email: { equals: email, mode: 'insensitive' } } }),
    ).resolves.toBe(1);
  });

  it('creates an invited user and stores only a token hash in one transaction', async () => {
    const admin = await bootstrap.run({
      name: 'Inviting Admin',
      email: `inviting-admin.${randomUUID()}@example.com`,
      password: 'another correct horse battery staple!',
    });
    createdUserIds.push(admin.id);

    const invitation = await adminUsers.invite(admin.id, {
      name: 'Private Player',
      email: `player.${randomUUID()}@example.com`,
      role: 'USER',
      expiresInHours: 24,
    });
    createdUserIds.push(invitation.user.id);
    const storedActivation = await prisma.accountActivation.findFirstOrThrow({
      where: { userId: invitation.user.id },
    });
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { targetUserId: invitation.user.id, action: 'USER_INVITED' },
    });

    expect(invitation.activationToken).toHaveLength(43);
    expect(storedActivation.tokenHash).toHaveLength(64);
    expect(JSON.stringify(storedActivation)).not.toContain(invitation.activationToken);
    expect(JSON.stringify(audit)).not.toContain(invitation.activationToken);
    expect(invitation.user).not.toHaveProperty('passwordHash');
  });
});
