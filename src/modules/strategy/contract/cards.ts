import { z } from 'zod';

const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'] as const;
const SUITS = ['s', 'h', 'd', 'c'] as const;

export const cardSchema = z
  .string()
  .regex(/^[AKQJT2-9][shdc]$/, 'Card must be rank+suits like "As" or "Th"');

export type Card = z.infer<typeof cardSchema>;

export function isValidCard(card: string): boolean {
  return cardSchema.safeParse(card).success;
}

export function rankOf(card: string): string {
  return card.slice(0, -1);
}

export function suitOf(card: string): string {
  return card.slice(-1);
}

const rankOrder = new Map<string, number>(RANKS.map((rank, index) => [rank, RANKS.length - index]));

export function rankStrength(rank: string): number {
  return rankOrder.get(rank) ?? 0;
}

const handClassPattern = /^(?:[AKQJT2-9]{2}[so]|[AKQJT2-9]{2})$/;

export const handClassSchema = z
  .string()
  .regex(handClassPattern, 'Hand class must be like "AA", "AKs" or "AKo"');

export type HandClass = z.infer<typeof handClassSchema>;

const MAX_HAND_CLASSES = 169;

export const handClassListSchema = z
  .array(handClassSchema)
  .min(1)
  .max(MAX_HAND_CLASSES)
  .refine((classes) => new Set(classes).size === classes.length, {
    message: 'Hand classes must be unique',
  });

export const uniqueCards = (cards: readonly string[]): boolean =>
  new Set(cards).size === cards.length;

export const BOARD_LENGTH_BY_STREET = {
  PREFLOP: 0,
  FLOP: 3,
  TURN: 4,
  RIVER: 5,
} as const;

export const HOLE_CARD_COUNT = 2;

export { RANKS, SUITS };
