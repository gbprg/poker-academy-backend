import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { CreateTrainingSessionDto } from './training.dto.js';

type SpotDefinitionLike = {
  blinds?: unknown;
  seats?: unknown;
  hero?: unknown;
  board?: unknown;
  history?: unknown;
  pot?: unknown;
  legalActions?: unknown;
};

const MAX_QUESTIONS = 10;

@Injectable()
export class TrainingService {
  constructor(private readonly prisma: PrismaService) {}

  async createSession(userId: string, dto: CreateTrainingSessionDto) {
    const versions = await this.prisma.strategyVersion.findMany({
      where: {
        status: 'PUBLISHED',
        ...(dto.strategyVersionId ? { id: dto.strategyVersionId } : {}),
        ...(dto.spotId ? { spotId: dto.spotId } : {}),
        ...(dto.filters?.format ? { spot: { format: dto.filters.format as never } } : {}),
        ...(dto.filters?.valuation ? { model: dto.filters.valuation as never } : {}),
        ...(dto.filters?.street ? { spot: { street: dto.filters.street as never } } : {}),
        ...(dto.filters?.tableSize ? { spot: { tableSize: Number(dto.filters.tableSize) } } : {}),
      },
      take: 50,
      orderBy: [{ publishedAt: 'desc' }, { id: 'asc' }],
      select: {
        id: true,
        spotId: true,
        spot: {
          select: {
            spotKey: true,
            format: true,
            valuation: true,
            street: true,
            tableSize: true,
            definition: true,
          },
        },
        nodes: {
          orderBy: { nodeKey: 'asc' },
          take: 1,
          select: { id: true, nodeKey: true },
        },
      },
    });

    if (versions.length === 0) {
      throw new UnprocessableEntityException('NO_ELIGIBLE_EXERCISES');
    }

    const selected = versions.slice(0, MAX_QUESTIONS);
    const session = await this.prisma.trainingSession.create({
      data: {
        userId,
        filters: (dto.filters ?? {}) as never,
        scenario: (dto.scenario ?? {}) as never,
        questions: {
          create: selected.map((version, index) => {
            const node = version.nodes[0] ?? null;
            return {
              position: index + 1,
              spotId: version.spotId,
              strategyVersionId: version.id,
              nodeId: node?.id ?? null,
              snapshot: this.buildSnapshot(version.spot, node?.nodeKey ?? null) as never,
            };
          }),
        },
      },
      include: { questions: { orderBy: { position: 'asc' } } },
    });

    return {
      session: this.toSessionSummary(session, session.questions.length),
      question: this.toDeliveredQuestion(session.questions[0]),
    };
  }

  async getSession(userId: string, sessionId: string) {
    const session = await this.prisma.trainingSession.findFirst({
      where: { id: sessionId, userId },
      include: { questions: { orderBy: { position: 'asc' } } },
    });

    if (!session) {
      throw new NotFoundException('Sessão de treino não encontrada.');
    }

    return {
      session: this.toSessionSummary(session, session.questions.length),
      questions: session.questions.map((question) => ({
        id: question.id,
        position: question.position,
        answered: question.answeredAt !== null,
      })),
    };
  }

  async getQuestion(userId: string, sessionId: string, position: number) {
    const question = await this.prisma.trainingQuestion.findFirst({
      where: {
        sessionId,
        position,
        session: { userId },
      },
    });

    if (!question) {
      throw new NotFoundException('Questão de treino não encontrada.');
    }

    return { question: this.toDeliveredQuestion(question) };
  }

  private buildSnapshot(
    spot: {
      spotKey: string;
      format: string;
      valuation: string;
      street: string;
      tableSize: number;
      definition: unknown;
    },
    nodeKey: string | null,
  ) {
    const definition = (spot.definition ?? {}) as SpotDefinitionLike;
    return {
      spotKey: spot.spotKey,
      format: spot.format,
      valuation: spot.valuation,
      street: spot.street,
      tableSize: spot.tableSize,
      nodeKey,
      blinds: definition.blinds ?? null,
      seats: definition.seats ?? null,
      hero: definition.hero ?? null,
      board: definition.board ?? null,
      history: definition.history ?? null,
      pot: definition.pot ?? null,
      legalActions: definition.legalActions ?? null,
    };
  }

  private toSessionSummary(
    session: { id: string; status: string; createdAt: Date; completedAt: Date | null },
    totalQuestions: number,
  ) {
    return {
      id: session.id,
      status: session.status,
      createdAt: session.createdAt,
      completedAt: session.completedAt,
      totalQuestions,
    };
  }

  private toDeliveredQuestion(question: {
    id: string;
    position: number;
    snapshot: unknown;
    answeredAt: Date | null;
  }) {
    return {
      id: question.id,
      position: question.position,
      answered: question.answeredAt !== null,
      context: question.snapshot,
    };
  }
}
