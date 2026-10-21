import { describe, expect, it } from 'vitest';
import {
  BOARD_LENGTH_BY_STREET,
  assertBoardForStreet,
  assertUniqueCards,
  fullDeck,
  isCard,
  rankOf,
  suitOf,
} from './cards.js';
import { assertSeatsUnique, legalActions, applyAction, type BettingState, type SeatState } from './betting.js';
import { validateSpot } from './spot-validator.js';
import { DomainError } from './errors.js';

function seat(overrides: Partial<SeatState> & { seat: number; position: string }): SeatState {
  return { stack: 100, committed: 0, folded: false, allIn: false, ...overrides };
}

function preflopState(overrides: Partial<BettingState> = {}): BettingState {
  return {
    street: 'PREFLOP',
    seats: [
      seat({ seat: 1, position: 'UTG' }),
      seat({ seat: 7, position: 'BTN' }),
      seat({ seat: 8, position: 'SB', committed: 0.5, stack: 99.5 }),
      seat({ seat: 9, position: 'BB', committed: 1, stack: 99 }),
    ],
    currentBet: 1,
    lastRaiseSize: 0,
    actorSeat: 1,
    lastAggressorSeat: null,
    ...overrides,
  };
}

describe('cards', () => {
  it('builds the full 52-card deck with unique cards', () => {
    const deck = fullDeck();
    expect(deck).toHaveLength(52);
    expect(new Set(deck).size).toBe(52);
    expect(deck.every(isCard)).toBe(true);
  });

  it('parses rank and suit', () => {
    expect(rankOf('As')).toBe('A');
    expect(suitOf('Th')).toBe('h');
  });

  it('rejects invalid cards', () => {
    expect(isCard('Xs')).toBe(false);
    expect(() => rankOf('1s')).toThrow(DomainError);
  });
});

describe('card uniqueness and board length', () => {
  it('rejects duplicate cards', () => {
    try {
      assertUniqueCards(['As', 'As']);
      throw new Error('expected throw');
    } catch (error) {
      expect((error as DomainError).code).toBe('DUPLICATE_CARD');
    }
  });

  it('accepts boards of 3, 4 and 5 cards matching the street', () => {
    expect(BOARD_LENGTH_BY_STREET).toMatchObject({ PREFLOP: 0, FLOP: 3, TURN: 4, RIVER: 5 });
    expect(() => assertBoardForStreet('FLOP', ['As', 'Kd', '7c'])).not.toThrow();
    expect(() => assertBoardForStreet('TURN', ['As', 'Kd', '7c', '2h'])).not.toThrow();
    expect(() => assertBoardForStreet('RIVER', ['As', 'Kd', '7c', '2h', '9s'])).not.toThrow();
  });

  it('rejects a board whose length does not match the street', () => {
    expect(() => assertBoardForStreet('FLOP', ['As', 'Kd'])).toThrowError(/FLOP/);
    expect(() => assertBoardForStreet('PREFLOP', ['As'])).toThrow(DomainError);
  });
});

describe('seat consistency', () => {
  it('rejects duplicate seat numbers', () => {
    expect(() => assertSeatsUnique([{ seat: 1 }, { seat: 1 }])).toThrow(DomainError);
  });
});

describe('betting legality', () => {
  it('rejects an action from a seat that is not to act', () => {
    const state = preflopState();
    expect(() => applyAction(state, { seat: 7, action: 'RAISE', amountTo: 3, increment: 3 })).toThrowError(
      /not to act/,
    );
  });

  it('requires a raise to meet the minimum', () => {
    const afterOpen = applyAction(preflopState(), { seat: 1, action: 'RAISE', amountTo: 2, increment: 2 });
    expect(afterOpen.currentBet).toBe(2);
    expect(afterOpen.lastRaiseSize).toBe(1);
  });

  it('computes min-raise-to from the last raise size', () => {
    const state = preflopState({ currentBet: 2, lastRaiseSize: 1 });
    expect(legalActions(state).minRaiseTo).toBe(3);
  });

  it('rejects a raise below the minimum', () => {
    const state = preflopState({ currentBet: 2, lastRaiseSize: 1 });
    expect(() => applyAction(state, { seat: 1, action: 'RAISE', amountTo: 2.5, increment: 2.5 })).toThrowError(
      /minimum/,
    );
  });

  it('rejects a call when there is nothing to call', () => {
    const state = preflopState({ currentBet: 1, seats: [seat({ seat: 9, position: 'BB', committed: 1 })] , actorSeat: 9 });
    expect(() => applyAction(state, { seat: 9, action: 'CALL', amountTo: 1, increment: 0 })).toThrow(DomainError);
  });

  it('allows check when there is no bet to face', () => {
    const state: BettingState = {
      street: 'FLOP',
      seats: [seat({ seat: 1, position: 'BTN' }), seat({ seat: 2, position: 'BB' })],
      currentBet: 0,
      lastRaiseSize: 0,
      actorSeat: 1,
      lastAggressorSeat: null,
    };
    expect(legalActions(state).canCheck).toBe(true);
    expect(() => applyAction(state, { seat: 1, action: 'CHECK', amountTo: 0, increment: 0 })).not.toThrow();
  });

  it('marks a full all-in raise and keeps action math coherent', () => {
    const state = preflopState({
      actorSeat: 1,
      seats: [seat({ seat: 1, position: 'UTG', stack: 5 }), seat({ seat: 9, position: 'BB', committed: 1, stack: 99 })],
      currentBet: 2,
      lastRaiseSize: 1,
    });
    const next = applyAction(state, { seat: 1, action: 'ALL_IN', amountTo: 0, increment: 0 });
    expect(next.currentBet).toBe(5);
    expect(next.seats.find((s) => s.seat === 1)?.stack).toBe(0);
    expect(next.seats.find((s) => s.seat === 1)?.allIn).toBe(true);
  });

  it('rejects an action that exceeds the stack (non-all-in raise)', () => {
    const state = preflopState({
      actorSeat: 1,
      seats: [seat({ seat: 1, position: 'UTG', stack: 3 }), seat({ seat: 9, position: 'BB', committed: 1, stack: 99 })],
      currentBet: 1,
      lastRaiseSize: 1,
    });
    expect(() => applyAction(state, { seat: 1, action: 'RAISE', amountTo: 10, increment: 10 })).toThrowError(
      /exceeds stack/,
    );
  });
});

describe('RFI and spot validation', () => {
  const base = {
    street: 'PREFLOP' as const,
    seats: [
      { seat: 7, position: 'BTN', stack: 20, isHero: true },
      { seat: 8, position: 'SB', stack: 20 },
      { seat: 9, position: 'BB', stack: 20 },
    ],
    board: [] as string[],
    history: [
      {
        street: 'PREFLOP',
        actions: [
          { seat: 8, action: 'CALL' as const, amountTo: 0.5, increment: 0.5 },
        ],
      },
    ],
    pot: { chips: 1.5, chipsAtStreetStart: 1.5 },
  };

  it('rejects an RFI spot that contains a prior voluntary action', () => {
    const issues = validateSpot({ ...base, isRfi: true });
    expect(issues.some((issue) => issue.code === 'RFI_WITH_PRIOR_ACTION')).toBe(true);
  });

  it('accepts a clean RFI spot with only blinds posted', () => {
    const clean = {
      ...base,
      history: [
        {
          street: 'PREFLOP',
          actions: [
            { seat: 8, action: 'FOLD' as const, amountTo: 0.5, increment: 0.5 },
            { seat: 9, action: 'CHECK' as const, amountTo: 1, increment: 0 },
          ],
        },
      ],
      isRfi: true,
    };
    expect(validateSpot(clean)).toHaveLength(0);
  });

  it('flags a hero/board card collision as a duplicate', () => {
    const issues = validateSpot({
      ...base,
      street: 'FLOP',
      board: ['Ah', 'Kd', '7c'],
      heroHoleCards: ['Ah', 'Qs'],
    });
    expect(issues.some((issue) => issue.code === 'DUPLICATE_CARD')).toBe(true);
  });

  it('flags a pot smaller than the street-start pot', () => {
    const issues = validateSpot({ ...base, pot: { chips: 1, chipsAtStreetStart: 2 } });
    expect(issues.some((issue) => issue.code === 'INCONSISTENT_POT')).toBe(true);
  });

  it('flags a non-decimal stack', () => {
    const issues = validateSpot({
      ...base,
      seats: [
        { seat: 7, position: 'BTN', stack: 20.123, isHero: true },
        { seat: 8, position: 'SB', stack: 20 },
        { seat: 9, position: 'BB', stack: 20 },
      ],
    });
    expect(issues.some((issue) => issue.code === 'INCONSISTENT_STACK')).toBe(true);
  });

  it('requires exactly one hero', () => {
    const issues = validateSpot({
      ...base,
      seats: [
        { seat: 7, position: 'BTN', stack: 20, isHero: true },
        { seat: 8, position: 'SB', stack: 20, isHero: true },
        { seat: 9, position: 'BB', stack: 20 },
      ],
    });
    expect(issues.some((issue) => issue.code === 'INVALID_ACTION')).toBe(true);
  });
});
