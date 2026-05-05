import { PreliminaryDecision } from './shared-types';

export interface IDecisionRepository {
  savePreliminary(decision: PreliminaryDecision): Promise<void>;
  updateConfirmed(requestId: string, tripId: string, userChoice: 'original' | 'suggested'): Promise<void>;
  findByRequestId(requestId: string): Promise<PreliminaryDecision | null>;
}

export const DECISION_REPOSITORY = Symbol('IDecisionRepository');
