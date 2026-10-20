import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { IdentityRepository } from '../src/modules/identity/identity.repository.js';

const databaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://poker_academy:poker_academy_local@localhost:55432/poker_academy?schema=public';

describe('identity persistence', () => {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
  const repository = new IdentityRepository(prisma);
  const createdUserIds: string[] = [];

  afterAll(async () => {
    await prisma.authSession.deleteMany({
      where: { userId: { in: createdUserIds } },
    });
    await prisma.accountActivation.deleteMany({
      where: { userId: { in: createdUserIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  });

  it('normalizes email and enforces case-insensitive uniqueness in PostgreSQL', async () => {
    const email = `Owner.${randomUUID()}@Example.com`;
    const user = await repository.createInvitedUser({
      name: 'Owner',
      email: `  ${email}  `,
      role: 'ADMIN',
    });
    createdUserIds.push(user.id);

    expect(user).toMatchObject({ email: email.toLowerCase(), status: 'INVITED' });
    expect(user).not.toHaveProperty('passwordHash');

    await expect(
      repository.createInvitedUser({
        name: 'Duplicate',
        email: email.toUpperCase(),
        role: 'USER',
      }),
    ).rejects.toBeDefined();
  });

  it('stores activation tokens only as deterministic hashes', async () => {
    const user = await repository.createInvitedUser({
      name: 'Invitee',
      email: `invitee.${randomUUID()}@example.com`,
      role: 'USER',
    });
    createdUserIds.push(user.id);
    const rawToken = `activation-${randomUUID()}`;

    const activation = await repository.createActivation({
      userId: user.id,
      rawToken,
      expiresAt: new Date(Date.now() + 60_000),
    });
    const stored = await prisma.accountActivation.findUniqueOrThrow({
      where: { id: activation.id },
    });

    expect(stored.tokenHash).toHaveLength(64);
    expect(stored.tokenHash).not.toContain(rawToken);
    expect(JSON.stringify(stored)).not.toContain(rawToken);

    await expect(
      repository.createActivation({
        userId: user.id,
        rawToken: randomUUID(),
        expiresAt: new Date(Date.now() - 1),
      }),
    ).rejects.toThrow('Activation expiry must be in the future');
  });

  it('enforces unique JTI and only resolves live, unrevoked sessions', async () => {
    const user = await repository.createInvitedUser({
      name: 'Session owner',
      email: `session.${randomUUID()}@example.com`,
      role: 'USER',
    });
    createdUserIds.push(user.id);
    const jti = randomUUID();
    const now = new Date();

    await repository.createSession({
      userId: user.id,
      jti,
      issuedAt: now,
      expiresAt: new Date(now.getTime() + 60_000),
    });

    await expect(
      repository.createSession({
        userId: user.id,
        jti,
        issuedAt: now,
        expiresAt: new Date(now.getTime() + 120_000),
      }),
    ).rejects.toBeDefined();
    await expect(
      repository.createSession({
        userId: user.id,
        jti: randomUUID(),
        issuedAt: now,
        expiresAt: new Date(now.getTime() - 1),
      }),
    ).rejects.toBeDefined();
    await expect(repository.findLiveSession(jti, now)).resolves.not.toBeNull();
    await expect(
      repository.findLiveSession(jti, new Date(now.getTime() + 120_000)),
    ).resolves.toBeNull();
  });

  it('prevents deleting a user that owns identity history', async () => {
    const user = await repository.createInvitedUser({
      name: 'Protected history',
      email: `protected.${randomUUID()}@example.com`,
      role: 'USER',
    });
    createdUserIds.push(user.id);
    await repository.createActivation({
      userId: user.id,
      rawToken: randomUUID(),
      expiresAt: new Date(Date.now() + 60_000),
    });

    await expect(prisma.user.delete({ where: { id: user.id } })).rejects.toBeDefined();
  });
});
