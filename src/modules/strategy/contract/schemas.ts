import { z } from 'zod';
import { BOARD_LENGTH_BY_STREET, HOLE_CARD_COUNT, cardSchema, handClassSchema, uniqueCards } from './cards.js';
import {
  CONTRACT_SCHEMA_VERSION,
  actionTypeSchema,
  gameFormatSchema,
  positionSchema,
  sourceMethodSchema,
  strategyStatusSchema,
  streetSchema,
  tableSizeSchema,
  valuationModelSchema,
} from './enums.js';
import { canonicalize, fingerprintOf } from './fingerprint.js';

const positiveDecimal = z.number().positive();

const blindStructureSchema = z
  .object({
    smallBlind: positiveDecimal,
    bigBlind: positiveDecimal,
    anteType: z.enum(['NONE', 'COMMON', 'BB_ANTE']),
    anteValue: z.number().min(0).default(0),
  })
  .strict()
  .refine((blinds) => blinds.bigBlind > blinds.smallBlind, {
    message: 'bigBlind must be greater than smallBlind',
  })
  .refine((blinds) => blinds.anteType !== 'NONE' || blinds.anteValue === 0, {
    message: 'anteValue must be 0 when anteType is NONE',
  });

export type BlindStructure = z.infer<typeof blindStructureSchema>;

const seatSchema = z
  .object({
    seat: z.number().int().nonnegative(),
    position: positionSchema,
    stack: z.object({ chips: positiveDecimal, bb: positiveDecimal }).strict(),
    isHero: z.boolean().default(false),
    isActive: z.boolean().default(true),
  })
  .strict();

export type Seat = z.infer<typeof seatSchema>;

const seatListSchema = z
  .array(seatSchema)
  .min(2)
  .refine((seats) => new Set(seats.map((seat) => seat.seat)).size === seats.length, {
    message: 'Seat numbers must be unique',
  })
  .refine((seats) => seats.filter((seat) => seat.isHero).length === 1, {
    message: 'Exactly one seat must be marked as hero',
  });

const bettingActionSchema = z
  .object({
    seat: z.number().int().nonnegative(),
    position: positionSchema,
    action: actionTypeSchema,
    amountTo: z.number().min(0).default(0),
    increment: z.number().min(0).default(0),
  })
  .strict()
  .refine(
    (entry) =>
      entry.action === 'FOLD' || entry.action === 'CHECK'
        ? true
        : entry.increment > 0 || entry.action === 'ALL_IN',
    { message: 'BET/RAISE/CALL require a positive increment unless ALL_IN' },
  );

export type BettingHistoryEntry = z.infer<typeof bettingActionSchema>;

const bettingHistorySchema = z
  .object({
    street: streetSchema,
    actions: z.array(bettingActionSchema),
  })
  .strict();

export type BettingHistory = z.infer<typeof bettingHistorySchema>;

const boardSchema = z
  .array(cardSchema)
  .max(5)
  .refine(uniqueCards, { message: 'Board cards must be unique' });

const holeCardsSchema = z
  .array(cardSchema)
  .max(HOLE_CARD_COUNT)
  .refine(uniqueCards, { message: 'Hole cards must be unique' });

const heroSchema = z
  .object({
    seat: z.number().int().nonnegative(),
    position: positionSchema,
    handClass: handClassSchema.optional(),
    holeCards: holeCardsSchema.optional(),
  })
  .strict();

export type Hero = z.infer<typeof heroSchema>;

const potSchema = z
  .object({
    chips: z.number().min(0),
    chipsAtStreetStart: z.number().min(0),
  })
  .strict();

const payoutSchema = z
  .object({
    remainingPlayers: z.number().int().positive(),
    paidPositions: z.number().int().positive(),
    prizes: z.array(z.number().min(0)).min(1),
  })
  .strict()
  .refine((payout) => payout.paidPositions <= payout.remainingPlayers, {
    message: 'paidPositions cannot exceed remainingPlayers',
  })
  .refine((payout) => payout.prizes.length === payout.paidPositions, {
    message: 'prizes length must equal paidPositions',
  });

const bountySchema = z
  .object({
    playerBounties: z.array(z.number().min(0)).min(1),
  })
  .strict();

export const spotDefinitionSchema = z
  .object({
    schemaVersion: z.literal(CONTRACT_SCHEMA_VERSION),
    spotId: z.string().min(1),
    format: gameFormatSchema,
    tableSize: tableSizeSchema,
    valuation: valuationModelSchema,
    street: streetSchema,
    blinds: blindStructureSchema,
    seats: seatListSchema,
    hero: heroSchema,
    board: boardSchema,
    history: z.array(bettingHistorySchema),
    pot: potSchema,
    payout: payoutSchema.optional(),
    bounty: bountySchema.optional(),
    legalActions: z.array(actionTypeSchema).min(1),
    canonicalFingerprint: z.string().min(1).optional(),
    demoLabel: z.literal('DEMO_NOT_GTO').optional(),
  })
  .strict()
  .superRefine((spot, ctx) => {
    const expectedBoard = BOARD_LENGTH_BY_STREET[spot.street];
    if (spot.board.length !== expectedBoard) {
      ctx.addIssue({
        code: 'custom',
        path: ['board'],
        message: `Board must have ${expectedBoard} cards for ${spot.street}`,
      });
    }

    const heroSeat = spot.seats.find((seat) => seat.seat === spot.hero.seat);
    if (!heroSeat || !heroSeat.isHero) {
      ctx.addIssue({
        code: 'custom',
        path: ['hero', 'seat'],
        message: 'Hero seat must reference a seat marked as hero',
      });
    }

    if (spot.hero.holeCards) {
      const combined = [...spot.hero.holeCards, ...spot.board];
      if (!uniqueCards(combined)) {
        ctx.addIssue({
          code: 'custom',
          path: ['hero', 'holeCards'],
          message: 'Hole cards cannot duplicate board cards',
        });
      }
    }

    if (spot.valuation === 'ICM' || spot.valuation === 'PKO') {
      if (spot.format !== 'MTT') {
        ctx.addIssue({
          code: 'custom',
          path: ['valuation'],
          message: 'ICM/PKO require MTT format in this contract version',
        });
      }
      if (!spot.payout) {
        ctx.addIssue({
          code: 'custom',
          path: ['payout'],
          message: 'ICM/PKO require a payout structure',
        });
      }
    }

    if (spot.valuation === 'PKO' && !spot.bounty) {
      ctx.addIssue({
        code: 'custom',
        path: ['bounty'],
        message: 'PKO requires a bounty structure',
      });
    }
  });

export type SpotDefinition = z.infer<typeof spotDefinitionSchema>;

export const strategyVersionSchema = z
  .object({
    schemaVersion: z.literal(CONTRACT_SCHEMA_VERSION),
    strategyVersionId: z.string().min(1),
    spotId: z.string().min(1),
    sourceId: z.string().min(1),
    status: strategyStatusSchema,
    method: sourceMethodSchema,
    model: z.enum(['CHIP_EV', 'ICM', 'PKO', 'EDITORIAL']),
    versionTag: z.string().min(1),
    checksum: z.string().min(1),
    publishedAt: z.string().datetime().optional(),
    validationEvidence: z.array(z.string().min(1)),
    demoLabel: z.literal('DEMO_NOT_GTO').optional(),
  })
  .strict();

export type StrategyVersion = z.infer<typeof strategyVersionSchema>;

const frequencySchema = z.number().min(0).max(1);

export const strategyActionSchema = z
  .object({
    combo: handClassSchema,
    actionType: actionTypeSchema,
    sizing: z.number().min(0).optional(),
    frequency: frequencySchema,
    evNullable: z.number().nullable().default(null),
    unitNullable: z.enum(['CHIPS', 'BB', 'ICM_PERCENT']).nullable().default(null),
  })
  .strict();

export type StrategyAction = z.infer<typeof strategyActionSchema>;

export const decisionNodeSchema = z
  .object({
    schemaVersion: z.literal(CONTRACT_SCHEMA_VERSION),
    nodeId: z.string().min(1),
    spotId: z.string().min(1),
    strategyVersionId: z.string().min(1),
    actions: z.array(strategyActionSchema).min(1),
    tolerance: z.number().min(0).max(0.05).default(0.001),
    demoLabel: z.literal('DEMO_NOT_GTO').optional(),
  })
  .strict()
  .superRefine((node, ctx) => {
    const totalsByCombo = new Map<string, number>();
    for (const action of node.actions) {
      totalsByCombo.set(action.combo, (totalsByCombo.get(action.combo) ?? 0) + action.frequency);
    }
    for (const [combo, total] of totalsByCombo) {
      if (Math.abs(total - 1) > node.tolerance + 1e-9) {
        ctx.addIssue({
          code: 'custom',
          path: ['actions'],
          message: `Frequencies for ${combo} sum to ${total.toFixed(4)} (must be 1 within tolerance)`,
        });
      }
    }
  });

export type DecisionNode = z.infer<typeof decisionNodeSchema>;

export function computeSpotFingerprint(spot: SpotDefinition): string {
  const { canonicalFingerprint: _ignored, ...rest } = spot;
  return fingerprintOf(canonicalize(rest));
}
