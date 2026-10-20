import { describe, expect, it } from 'vitest';
import { PasswordService } from './password.service.js';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('hashes passwords with the approved Argon2id parameters', async () => {
    const hash = await service.hash('a-long-private-password');

    expect(hash).toMatch(/^\$argon2id\$v=19\$/);
    expect(hash).toContain('m=19456');
    expect(hash).toContain('t=2');
    expect(hash).toContain('p=1');
    await expect(service.verify(hash, 'a-long-private-password')).resolves.toBe(true);
    await expect(service.verify(hash, 'wrong-password')).resolves.toBe(false);
  });
});
