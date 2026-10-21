import { domainError } from './errors.js';

export const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'] as const;
export const SUITS = ['s', 'h', 'd', 'c'] as const;

export type Rank = (typeof RANKS)[number];
export type Suit = (typeof SUITS)[number];

const CARD_PATTERN = /^[AKQJT2-9][shdc]$/;

export function isCard(value: string): boolean {
  return CARD_PATTERN.test(value);
}

export function rankOf(card: string): Rank {
  if (!isCard(card)) throw domainError('INVALID_CARD', `Invalid card: ${card}`, { card });
  return card.slice(0, -1) as Rank;
}

export function suitOf(card: string): Suit {
  if (!isCard(card)) throw domainError('INVALID_CARD', `Invalid card: ${card}`, { card });
  return card.slice(-1) as Suit;
}

export function fullDeck(): string[] {
  const deck: string[] = [];
  for (const rank of RANKS) for (const suit of SUITS) deck.push(`${rank}${suit}`);
  return deck;
}

export function assertUniqueCards(cards: readonly string[]): void {
  for (const card of cards) {
    if (!isCard(card)) throw domainError('INVALID_CARD', `Invalid card: ${card}`, { card });
  }
  const seen = new Set<string>();
  for (const card of cards) {
    if (seen.has(card)) throw domainError('DUPLICATE_CARD', `Duplicate card: ${card}`, { card });
    seen.add(card);
  }
}

export const BOARD_LENGTH_BY_STREET = {
  PREFLOP: 0,
  FLOP: 3,
  TURN: 4,
  RIVER: 5,
} as const;

export function assertBoardForStreet(street: keyof typeof BOARD_LENGTH_BY_STREET, board: readonly string[]): void {
  assertUniqueCards(board);
  const expected = BOARD_LENGTH_BY_STREET[street];
  if (board.length !== expected) {
    throw domainError('INVALID_BOARD_LENGTH', `Board must have ${expected} cards for ${street}`, {
      street,
      expected,
      received: board.length,
    });
  }
}
