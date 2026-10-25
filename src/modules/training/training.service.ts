import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateSessionDto } from './dto/create-session.dto.js';
import { EligibleCountDto } from './dto/eligible-count.dto.js';
import { SubmitAnswerDto } from './dto/submit-answer.dto.js';
import { mixV1Scoring } from './scoring/mix-v1.scoring.js';

@Injectable()
export class TrainingService {
  constructor(private readonly prisma: PrismaService) {}

  async startQuick(userId: string) {
    const spots = await (this.prisma as any).spot.findMany({
      where: { street: { in: ['PREFLOP', 'FLOP'] } },
      take: 5,
    });
    if (spots.length === 0) throw new NotFoundException('Nenhum spot disponivel para quiz rapido.');
    const spot = spots[Math.floor(Math.random() * spots.length)];
    const versions = await (this.prisma as any).strategyVersion.findMany({
      where: { spotId: spot.id, status: 'PUBLISHED' },
      take: 1,
    });
    if (versions.length === 0) throw new NotFoundException('Nenhum spot publicado disponivel.');
    const session = await (this.prisma as any).trainingSession.create({
      data: {
        userId,
        spotId: spot.id,
        strategyVersionId: versions[0].id,
        status: 'IN_PROGRESS',
        config: { quick: true },
        updatedAt: new Date(),
      },
    });

    const trees = await (this.prisma as any).strategyNode.findMany({
      where: { strategyVersionId: versions[0].id },
      take: 20,
    });
    if (trees.length === 0) throw new NotFoundException('Nenhum no elegivel.');
    const node = trees[Math.floor(Math.random() * trees.length)];
    const question = await (this.prisma as any).trainingQuestion.create({
      data: {
        sessionId: session.id,
        spotId: spot.id,
        strategyVersionId: versions[0].id,
        nodeId: node.id,
        position: 1,
        snapshot: {
          spotKey: spot.spotKey,
          format: spot.format,
          valuation: spot.valuation,
          street: spot.street,
          tableSize: spot.tableSize,
          nodeKey: node.nodeKey,
          blinds: null,
          seats: null,
          hero: null,
          board: null,
          history: null,
          pot: null,
          legalActions: ['FOLD', 'CALL', 'RAISE'],
        },
        updatedAt: new Date(),
      },
    });

    return {
      session: { id: session.id, status: session.status, createdAt: session.createdAt, completedAt: null, totalQuestions: 1 },
      question: { id: question.id, position: 1, answered: false, context: question.snapshot },
    };
  }

  // ... minimal stubs to keep class valid if needed
}
