import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { CreateTrainingSessionDto, SubmitTrainingAnswerDto } from './training.dto.js';
import { TrainingScoringService, type ScorableAction } from './training-scoring.service.js';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly scoring: TrainingScoringService,
  ) {}

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

  async submitAnswer(
    userId: string,
    sessionId: string,
    position: number,
    dto: SubmitTrainingAnswerDto,
  ) {
    const question = await this.prisma.trainingQuestion.findFirst({
      where: { sessionId, position, session: { userId } },
      select: {
        id: true,
        strategyVersionId: true,
        nodeId: true,
        snapshot: true,
      },
    });

    if (!question) {
      throw new NotFoundException('Questão de treino não encontrada.');
    }

    const existing = await this.prisma.trainingAttempt.findFirst({
      where: { questionId: question.id, userId },
    });
    if (existing) {
      return this.toAnswerFeedback(existing, true);
    }

    if (!question.nodeId) {
      throw new UnprocessableEntityException('QUESTION_WITHOUT_ANSWER_KEY');
    }

    const node = await this.prisma.strategyNode.findUnique({
      where: { id: question.nodeId },
      select: {
        actions: {
          select: {
            handClass: true,
            actionType: true,
            sizing: true,
            frequency: true,
            evNullable: true,
          },
        },
      },
    });

    const snapshot = (question.snapshot ?? {}) as {
      hero?: { handClass?: unknown };
      legalActions?: unknown;
    };
    const heroHandClass =
      snapshot.hero && typeof snapshot.hero.handClass === 'string'
        ? snapshot.hero.handClass
        : null;
    const legalActions = Array.isArray(snapshot.legalActions)
      ? snapshot.legalActions.filter((value): value is string => typeof value === 'string')
      : null;

    const actions: ScorableAction[] = (node?.actions ?? []).map((action) => ({
      handClass: action.handClass,
      actionType: action.actionType,
      sizing: action.sizing,
      frequency: action.frequency,
      evNullable: action.evNullable,
    }));

    const input = {
      heroHandClass,
      legalActions,
      actions,
      chosenActionType: dto.actionType,
      chosenSizing: dto.sizing ?? null,
    };

    if (!this.scoring.isLegalAction(input)) {
      throw new UnprocessableEntityException('ILLEGAL_ACTION');
    }

    const result = this.scoring.score(input);

    try {
      const attempt = await this.prisma.$transaction(async (tx) => {
        const created = await tx.trainingAttempt.create({
          data: {
            questionId: question.id,
            userId,
            idempotencyKey: dto.idempotencyKey,
            actionType: dto.actionType,
            sizing: dto.sizing ?? null,
            score: result.score,
            evDelta: result.evDelta,
            scoringVersion: result.scoringVersion,
            feedback: {
              bestActionType: result.bestActionType,
              mix: result.mix,
            } as never,
          },
        });
        await tx.trainingQuestion.update({
          where: { id: question.id },
          data: { answeredAt: new Date() },
        });
        return created;
      });
      return this.toAnswerFeedback(attempt, false);
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        const original = await this.prisma.trainingAttempt.findFirst({
          where: { questionId: question.id, userId },
        });
        if (original) {
          return this.toAnswerFeedback(original, true);
        }
        throw new ConflictException('ANSWER_ALREADY_SUBMITTED');
      }
      throw error;
    }
  }

  private toAnswerFeedback(
    attempt: {
      actionType: string;
      sizing: unknown;
      score: unknown;
      evDelta: unknown;
      scoringVersion: string;
      feedback: unknown;
    },
    duplicate: boolean,
  ) {
    const feedback = (attempt.feedback ?? {}) as {
      bestActionType?: string | null;
      mix?: Array<{ actionType: string; frequency: number }>;
    };
    return {
      duplicate,
      answer: {
        actionType: attempt.actionType,
        sizing: attempt.sizing === null ? null : Number(attempt.sizing),
      },
      score: Number(attempt.score),
      evDelta: attempt.evDelta === null ? null : Number(attempt.evDelta),
      bestActionType: feedback.bestActionType ?? null,
      mix: feedback.mix ?? [],
      scoringVersion: attempt.scoringVersion,
    };
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
