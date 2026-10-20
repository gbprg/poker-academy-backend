import { ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service.js';
import { HealthService } from './health.service.js';

describe('HealthService', () => {
  it('sanitizes database failures without exposing connection details', async () => {
    const prisma = {
      $queryRaw: async () => {
        throw new Error(
          'connection failed: postgresql://admin:secret@database.internal/app',
        );
      },
    } as unknown as PrismaService;
    const service = new HealthService(prisma);

    let thrown: unknown;
    try {
      await service.check();
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ServiceUnavailableException);
    expect((thrown as ServiceUnavailableException).getResponse()).toEqual({
      statusCode: 503,
      error: 'Service Unavailable',
      message: 'Banco de dados indisponivel',
    });
    expect(JSON.stringify(thrown)).not.toContain('database.internal');
    expect(JSON.stringify(thrown)).not.toContain('secret');
  });
});
