import { Injectable } from '@nestjs/common';

export const SCORING_VERSION = 'mix-v1';

export type ScorableAction = {
  handClass: string;
  actionType: string;
  sizing: unknown;
  frequency: unknown;
  evNullable: unknown;
};

export type ScoreInput = {
  heroHandClass: string | null;
  legalActions: string[] | null;
  actions: ScorableAction[];
  chosenActionType: string;
  chosenSizing: number | null;
};

export type ScoreResult = {
  score: number;
  evDelta: number | null;
  bestActionType: string | null;
  mix: Array<{ actionType: string; frequency: number }>;
  scoringVersion: string;
};

const SIZING_TOLERANCE = 0.011;

@Injectable()
export class TrainingScoringService {
  score(input: ScoreInput): ScoreResult {
    const relevant = this.selectHandActions(input.actions, input.heroHandClass);
    const mix = this.aggregateMix(relevant);

    if (mix.length === 0) {
      return {
        score: 0,
        evDelta: null,
        bestActionType: null,
        mix: [],
        scoringVersion: SCORING_VERSION,
      };
    }

    const chosen = mix.find((item) => item.actionType === input.chosenActionType);
    const best = mix.reduce((current, item) =>
      item.frequency > current.frequency ? item : current,
    );

    const chosenEv = this.bestEvFor(relevant, input.chosenActionType);
    const bestEv = this.bestEvFor(relevant, best.actionType);
    const evDelta =
      chosenEv === null || bestEv === null ? null : Number((bestEv - chosenEv).toFixed(6));

    return {
      score: chosen ? chosen.frequency : 0,
      evDelta,
      bestActionType: mix.length > 0 ? best.actionType : null,
      mix,
      scoringVersion: SCORING_VERSION,
    };
  }

  isLegalAction(input: ScoreInput): boolean {
    const relevant = this.selectHandActions(input.actions, input.heroHandClass);
    const allowed = new Set(relevant.map((action) => action.actionType));
    if (allowed.size === 0 && input.legalActions) {
      return input.legalActions.includes(input.chosenActionType);
    }
    if (!allowed.has(input.chosenActionType)) {
      return false;
    }
    if (input.chosenSizing === null) {
      return true;
    }
    return relevant.some(
      (action) =>
        action.actionType === input.chosenActionType &&
        action.sizing !== null &&
        Math.abs(Number(action.sizing) - input.chosenSizing!) <= SIZING_TOLERANCE,
    );
  }

  private selectHandActions(actions: ScorableAction[], heroHandClass: string | null) {
    const matching = actions.filter(
      (action) => heroHandClass !== null && action.handClass === heroHandClass,
    );
    return matching.length > 0 ? matching : actions;
  }

  private aggregateMix(actions: ScorableAction[]) {
    const byType = new Map<string, number>();
    for (const action of actions) {
      const current = byType.get(action.actionType) ?? 0;
      byType.set(action.actionType, current + Number(action.frequency));
    }
    return [...byType.entries()]
      .map(([actionType, frequency]) => ({
        actionType,
        frequency: Number(frequency.toFixed(5)),
      }))
      .sort((a, b) => b.frequency - a.frequency || a.actionType.localeCompare(b.actionType));
  }

  private bestEvFor(actions: ScorableAction[], actionType: string): number | null {
    const values = actions
      .filter((action) => action.actionType === actionType && action.evNullable !== null)
      .map((action) => Number(action.evNullable));
    return values.length === 0 ? null : Math.max(...values);
  }
}
