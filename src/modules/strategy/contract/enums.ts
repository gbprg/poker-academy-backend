import { z } from 'zod';

export const CONTRACT_SCHEMA_VERSION = '1.0.0' as const;

export const gameFormatSchema = z.enum(['MTT', 'SNG']);
export type GameFormat = z.infer<typeof gameFormatSchema>;

export const valuationModelSchema = z.enum(['CHIP_EV', 'ICM', 'PKO']);
export type ValuationModel = z.infer<typeof valuationModelSchema>;

export const streetSchema = z.enum(['PREFLOP', 'FLOP', 'TURN', 'RIVER']);
export type Street = z.infer<typeof streetSchema>;

export const tableSizeSchema = z.union([z.literal(6), z.literal(8), z.literal(9)]);
export type TableSize = z.infer<typeof tableSizeSchema>;

export const positionSchema = z.enum([
  'BTN',
  'SB',
  'BB',
  'UTG',
  'UTG1',
  'UTG2',
  'MP',
  'MP1',
  'MP2',
  'HJ',
  'CO',
]);
export type Position = z.infer<typeof positionSchema>;

export const actionTypeSchema = z.enum(['FOLD', 'CHECK', 'CALL', 'BET', 'RAISE', 'ALL_IN']);
export type ActionType = z.infer<typeof actionTypeSchema>;

export const strategyStatusSchema = z.enum([
  'VALIDATED',
  'EDITORIAL',
  'EXPERIMENTAL',
  'UNAVAILABLE',
  'BLOCKED_RIGHTS',
  'DEPRECATED',
]);
export type StrategyStatus = z.infer<typeof strategyStatusSchema>;

export const sourceMethodSchema = z.enum([
  'SOLVER_VERIFIED',
  'LICENSED',
  'EDITORIAL',
  'DEMO_NOT_GTO',
]);
export type SourceMethod = z.infer<typeof sourceMethodSchema>;
