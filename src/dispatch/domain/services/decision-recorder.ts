import { IDecisionRepository } from '../../../common/interfaces/IDecisionRepository';
import { PreliminaryDecision } from '../../../common/interfaces/shared-types';
import { RequestAlreadyConfirmedError } from '../../../common/errors/domain-error';

export class DecisionRecorder {
  constructor(private readonly repo: IDecisionRepository) {}

  async savePreliminary(decision: PreliminaryDecision): Promise<void> {
    await this.repo.savePreliminary(decision);
  }

  async updateConfirmed(requestId: string, tripId: string, userChoice: 'original' | 'suggested'): Promise<void> {
    const existing = await this.repo.findByRequestId(requestId);

    // If the record already has a tripId it was previously confirmed
    if (existing && (existing as PreliminaryDecision & { tripId?: string }).tripId) {
      throw new RequestAlreadyConfirmedError(`Request ${requestId} has already been confirmed`, { requestId });
    }

    await this.repo.updateConfirmed(requestId, tripId, userChoice);
  }
}
