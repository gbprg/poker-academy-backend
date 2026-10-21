import { domainError } from './errors.js';

export type ActionType = 'FOLD' | 'CHECK' | 'CALL' | 'BET' | 'RAISE' | 'ALL_IN';

export interface BettingEntry {
  seat: number;
  action: ActionType;
  /** Total amount committed by this seat for the street after the action. */
  amountTo: number;
  /** Increment added by this action relative to the seat's previous commitment. */
  increment: number;
  /** True when the action put the seat all-in for less than a full raise/call. */
  allInForLess?: boolean;
}

export interface SeatState {
  seat: number;
  position: string;
  stack: number;
  committed: number;
  folded: boolean;
  allIn: boolean;
}

export interface BettingState {
  seats: SeatState[];
  /** Current highest total commitment on the street. */
  currentBet: number;
  /** Size of the last full raise increment (used for min-raise). */
  lastRaiseSize: number;
  /** Seat that has the action. */
  actorSeat: number;
  /** Seat that opened the last aggression (bet/raise), for closing action. */
  lastAggressorSeat: number | null;
  street: 'PREFLOP' | 'FLOP' | 'TURN' | 'RIVER';
}

const POSITION_ORDER = [
  'UTG',
  'UTG1',
  'UTG2',
  'MP',
  'MP1',
  'MP2',
  'HJ',
  'CO',
  'BTN',
  'SB',
  'BB',
] as const;

export function assertSeatsUnique(seats: readonly { seat: number }[]): void {
  const seen = new Set<number>();
  for (const seat of seats) {
    if (seen.has(seat.seat)) {
      throw domainError('INCONSISTENT_STACK', `Duplicate seat number: ${seat.seat}`, { seat: seat.seat });
    }
    seen.add(seat.seat);
  }
}

export function minRaiseTo(state: BettingState): number {
  const raiseSize = state.lastRaiseSize > 0 ? state.lastRaiseSize : state.currentBet;
  return state.currentBet + raiseSize;
}

export interface LegalActionSet {
  canFold: boolean;
  canCheck: boolean;
  canCall: boolean;
  callAmount: number;
  canBet: boolean;
  canRaise: boolean;
  minRaiseTo: number;
  canAllIn: boolean;
}

export function legalActions(state: BettingState): LegalActionSet {
  const actor = state.seats.find((seat) => seat.seat === state.actorSeat);
  if (!actor) throw domainError('ILLEGAL_ACTION', `Unknown actor seat ${state.actorSeat}`);

  const toCall = Math.max(0, state.currentBet - actor.committed);
  const canCheck = toCall === 0;
  const canCall = toCall > 0 && toCall < actor.stack;
  const minRaiseToValue = minRaiseTo(state);
  const canRaise =
    actor.stack > toCall && actor.committed + actor.stack >= minRaiseToValue && state.lastRaiseSize > 0;

  return {
    canFold: true,
    canCheck,
    canCall,
    callAmount: Math.min(toCall, actor.stack),
    canBet: canCheck && actor.stack > 0,
    canRaise,
    minRaiseTo: minRaiseToValue,
    canAllIn: actor.stack > 0,
  };
}

export function applyAction(state: BettingState, entry: BettingEntry): BettingState {
  const seats = state.seats.map((seat) => ({ ...seat }));
  const actor = seats.find((seat) => seat.seat === entry.seat);
  if (!actor) throw domainError('ILLEGAL_ACTION', `Unknown seat ${entry.seat}`);
  if (actor.seat !== state.actorSeat) {
    throw domainError('ACTION_OUT_OF_ORDER', `Seat ${entry.seat} is not to act`, {
      expected: state.actorSeat,
      received: entry.seat,
    });
  }
  if (actor.folded || actor.allIn) {
    throw domainError('ILLEGAL_ACTION', `Seat ${entry.seat} cannot act`, { seat: entry.seat });
  }

  const legal = legalActions(state);
  let { currentBet } = state;
  let { lastRaiseSize } = state;
  let lastAggressorSeat = state.lastAggressorSeat;

  switch (entry.action) {
    case 'FOLD': {
      actor.folded = true;
      break;
    }
    case 'CHECK': {
      if (!legal.canCheck) {
        throw domainError('ILLEGAL_ACTION', 'Cannot check facing a bet', { seat: entry.seat });
      }
      break;
    }
    case 'CALL': {
      if (legal.callAmount <= 0) {
        throw domainError('ILLEGAL_ACTION', 'Nothing to call', { seat: entry.seat });
      }
      if (entry.amountTo !== actor.committed + legal.callAmount) {
        throw domainError('INVALID_SIZING', 'CALL amount does not match owed amount', {
          expected: actor.committed + legal.callAmount,
          received: entry.amountTo,
        });
      }
      actor.stack -= legal.callAmount;
      actor.committed += legal.callAmount;
      if (actor.stack === 0) actor.allIn = true;
      break;
    }
    case 'BET':
    case 'RAISE': {
      if (entry.amountTo <= currentBet) {
        throw domainError('ILLEGAL_ACTION', 'Bet/raise must exceed current bet', {
          currentBet,
          received: entry.amountTo,
        });
      }
      if (entry.amountTo < legal.minRaiseTo) {
        throw domainError('RAISE_BELOW_MINIMUM', `Raise below minimum (${legal.minRaiseTo})`, {
          minimum: legal.minRaiseTo,
          received: entry.amountTo,
        });
      }
      const incrementOverCommit = entry.amountTo - actor.committed;
      if (incrementOverCommit > actor.stack) {
        throw domainError('INSUFFICIENT_STACK', 'Action exceeds stack', {
          stack: actor.stack,
          required: incrementOverCommit,
        });
      }
      const raiseIncrement = entry.amountTo - currentBet;
      lastRaiseSize = raiseIncrement;
      currentBet = entry.amountTo;
      lastAggressorSeat = actor.seat;
      actor.stack -= incrementOverCommit;
      actor.committed = entry.amountTo;
      if (actor.stack === 0) actor.allIn = true;
      break;
    }
    case 'ALL_IN': {
      const target = actor.committed + actor.stack;
      const incrementOverCommit = actor.stack;
      actor.committed = target;
      actor.stack = 0;
      actor.allIn = true;
      if (target > currentBet) {
        const raiseIncrement = target - currentBet;
        if (raiseIncrement >= (lastRaiseSize > 0 ? lastRaiseSize : currentBet)) {
          lastRaiseSize = raiseIncrement;
        } else {
          entry.allInForLess = true;
        }
        currentBet = target;
        lastAggressorSeat = actor.seat;
      }
      if (incrementOverCommit === 0) {
        throw domainError('ILLEGAL_ACTION', 'All-in with no chips', { seat: entry.seat });
      }
      break;
    }
    default: {
      throw domainError('INVALID_ACTION', 'Unsupported action', { action: entry.action });
    }
  }

  const nextActor = nextSeatToAct(seats, state.actorSeat, lastAggressorSeat, currentBet);

  return { ...state, seats, currentBet, lastRaiseSize, lastAggressorSeat, actorSeat: nextActor };
}

function nextSeatToAct(
  seats: SeatState[],
  fromSeat: number,
  lastAggressorSeat: number | null,
  currentBet: number,
): number {
  const ordered = [...seats].sort((a, b) => orderIndex(a.position) - orderIndex(b.position));
  const startIndex = ordered.findIndex((seat) => seat.seat === fromSeat);
  for (let step = 1; step <= ordered.length; step += 1) {
    const candidate = ordered[(startIndex + step) % ordered.length];
    if (candidate.folded || candidate.allIn) continue;
    const owes = currentBet - candidate.committed;
    if (owes > 0) return candidate.seat;
    if (lastAggressorSeat !== null && candidate.seat !== lastAggressorSeat) {
      const aggressor = ordered.find((seat) => seat.seat === lastAggressorSeat);
      if (aggressor && !aggressor.folded && candidate.seat !== fromSeat) return candidate.seat;
    }
  }
  return -1;
}

function orderIndex(position: string): number {
  const index = POSITION_ORDER.indexOf(position as (typeof POSITION_ORDER)[number]);
  return index === -1 ? POSITION_ORDER.length : index;
}

export function isRfiViolation(history: readonly BettingEntry[]): boolean {
  return history.some((entry) => entry.action !== 'FOLD' && entry.action !== 'CHECK');
}

export { POSITION_ORDER };
