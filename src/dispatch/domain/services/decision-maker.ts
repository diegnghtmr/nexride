import { DispatchConfig } from '../../../common/config/dispatch.config';

export interface ScoredCombo {
  vehicleId: string;
  safePointId: string | null;
  proximity: number;
  energy: number;
  safety: number;
  continuity: number;
  total: number;
  etaSeconds: number;
  walkingMeters: number;
}

export interface SuggestionDraft {
  safePointId: string;
  walkingMeters: number;
  safetyImprovement: number;
}

export interface DispatchDecisionDraft {
  primary: ScoredCombo;
  suggestion?: SuggestionDraft;
}

/**
 * Tiebreak comparator: lower total loses; on equal total: vehicleId ASC, then safePointId ASC (null last).
 * Returns negative if a wins (comes first/higher priority), positive if b wins.
 */
function tiebreak(a: ScoredCombo, b: ScoredCombo): number {
  if (Math.abs(a.total - b.total) > 1e-9) {
    return b.total - a.total; // higher total is better
  }
  // Same total: vehicleId ASC
  if (a.vehicleId !== b.vehicleId) {
    return a.vehicleId < b.vehicleId ? -1 : 1;
  }
  // Same vehicleId: safePointId ASC, null sorts last
  if (a.safePointId === b.safePointId) return 0;
  if (a.safePointId === null) return 1;
  if (b.safePointId === null) return -1;
  return a.safePointId < b.safePointId ? -1 : 1;
}

export class DecisionMaker {
  constructor(private readonly cfg: DispatchConfig) {}

  decide(combos: ScoredCombo[]): DispatchDecisionDraft {
    if (combos.length === 0) {
      throw new Error('DecisionMaker.decide: combos array must not be empty');
    }

    // Sort by tiebreak — first element is the winner
    const sorted = [...combos].sort(tiebreak);
    const primary = sorted[0];

    // Find original (no safe point) and best safe-point combo for the primary vehicle
    const originalCombo = combos.find((c) => c.vehicleId === primary.vehicleId && c.safePointId === null);
    const safePointCombos = combos.filter((c) => c.vehicleId === primary.vehicleId && c.safePointId !== null);

    let suggestion: SuggestionDraft | undefined;

    if (originalCombo && safePointCombos.length > 0) {
      // Pick the best safe-point combo for this vehicle
      const bestSafeCombo = [...safePointCombos].sort(tiebreak)[0];

      const originalSafety = originalCombo.safety;
      const suggestedSafety = bestSafeCombo.safety;
      const relativeImprovement = (suggestedSafety - originalSafety) / originalSafety;

      // Suggestion iff improvement >= threshold AND walking <= safePointRadiusM (inclusive upper bound — matches ST_DWithin)
      // Use epsilon to handle floating-point boundary cases (e.g. 0.3 * 1.15 arithmetic)
      const EPSILON = 1e-9;
      if (
        relativeImprovement >= this.cfg.suggestionThresholdPct - EPSILON &&
        bestSafeCombo.walkingMeters <= this.cfg.safePointRadiusM
      ) {
        suggestion = {
          safePointId: bestSafeCombo.safePointId!,
          walkingMeters: bestSafeCombo.walkingMeters,
          safetyImprovement: relativeImprovement,
        };
      }
    }

    return { primary, suggestion };
  }
}
