import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string) {
    const profile = await (this.prisma as any).userProfile.findUnique({ where: { userId } });
    if (!profile) {
      return { settings: {} };
    }
    return { settings: profile.settings ?? {} };
  }

  async update(userId: string, dto: { settings?: Record<string, unknown> }) {
    const profile = await (this.prisma as any).userProfile.upsert({
      where: { userId },
      update: { settings: dto.settings ?? {} },
      create: { userId, settings: dto.settings ?? {}, updatedAt: new Date() },
    });
    return { settings: profile.settings ?? {} };
  }
}
