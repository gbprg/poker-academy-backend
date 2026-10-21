import { assertBoardForStreet, assertUniqueCards } from './cards.js';
import { assertSeatsUnique, isRfiViolation, type BettingEntry } from './betting.js';
import { domainError } from './errors.js';

export interface SpotSeatInput {
  seat: number;
  position: string;
  stack: number;
  isHero?: boolean;
}

export interface SpotInput {
  street: 'PREFLOP' | 'FLOP' | 'TURN' | 'RIVER';
  seats: SpotSeatInput[];
  board: string[];
  heroHoleCards?: string[];
  history: { street: string; actions: BettingEntry[] }[];
  pot: { chips: number; chipsAtStreetStart: number };
  isRfi?: boolean;
}

export interface ValidationIssue {
  code: string;
  path: string;
  message: string;
}

const positiveDecimals = (value: number): boolean =>
  Number.isFinite(value) && value > 0 && Number(value.toFixed(2)) === value;

export function validateSpot(spot: SpotInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const capture = (fn: () => void, code: string, path: string) => {
    try {
      fn();
    } catch (error) {
      const err = error as { code?: string; message: string; details?: Record<string, unknown> };
      issues.push({ code: err.code ?? code, path, message: err.message });
    }
  };

  capture(() => assertUniqueCards([...(spot.heroHoleCards ?? []), ...spot.board]), 'DUPLICATE_CARD', 'cards');
  capture(() => assertBoardForStreet(spot.street, spot.board), 'INVALID_BOARD_LENGTH', 'board');
  capture(() => assertSeatsUnique(spot.seats), 'INCONSISTENT_STACK', 'seats');

  const heroes = spot.seats.filter((seat) => seat.isHero);
  if (spot.seats.length > 0 && heroes.length !== 1) {
    issues.push({ code: 'INVALID_ACTION', path: 'seats', message: 'Exactly one hero seat is required' });
  }

  for (const seat of spot.seats) {
    if (!positiveDecimals(seat.stack)) {
      issues.push({ code: 'INCONSISTENT_STACK', path: `seats[${seat.seat}].stack`, message: 'Stack must be a positive decimal' });
    }
  }

  if (!positiveDecimals(spot.pot.chips) && spot.pot.chips !== 0) {
    issues.push({ code: 'INCONSISTENT_POT', path: 'pot.chips', message: 'Pot must be a non-negative decimal' });
  }
  if (spot.pot.chips < spot.pot.chipsAtStreetStart) {
    issues.push({ code: 'INCONSISTENT_POT', path: 'pot.chips', message: 'Pot cannot be smaller than street-start pot' });
  }

  if (spot.isRfi) {
    const preflop = spot.history.find((entry) => entry.street === 'PREFLOP');
    if (preflop && isRfiViolation(preflop.actions)) {
      issues.push({
        code: 'RFI_WITH_PRIOR_ACTION',
        path: 'history.PREFLOP',
        message: 'RFI spot cannot contain a prior voluntary action before the hero',
      });
    }
  }

  return issues;
}

export function assertValidSpot(spot: SpotInput): void {
  const issues = validateSpot(spot);
  if (issues.length > 0) {
    const first = issues[0];
    throw domainError(first.code as never, first.message, { issues });
  }
}
