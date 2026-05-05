import { DecisionRecorder } from '../../../../src/dispatch/domain/services/decision-recorder';
import { IDecisionRepository } from '../../../../src/common/interfaces/IDecisionRepository';
import { PreliminaryDecision } from '../../../../src/common/interfaces/shared-types';
import { RequestAlreadyConfirmedError } from '../../../../src/common/errors/domain-error';

function makePreliminary(overrides: Partial<PreliminaryDecision> = {}): PreliminaryDecision {
  return {
    requestId: 'req-001',
    riderId: 'rider-001',
    origin: { lat: 4.65, lng: -74.05 },
    destination: { lat: 4.70, lng: -74.06 },
    winnerVehicleId: 'VH-001',
    suggestedPointId: undefined,
    scoresJson: { proximity: 0.6, energy: 0.8 },
    fallbackReason: undefined,
    suggestionStatus: 'not_shown',
    pipelineDurationMs: 250,
    ...overrides,
  };
}

function makeRepo(overrides: Partial<Record<keyof IDecisionRepository, jest.Mock>> = {}): IDecisionRepository {
  return {
    savePreliminary: jest.fn().mockResolvedValue(undefined),
    updateConfirmed: jest.fn().mockResolvedValue(undefined),
    findByRequestId: jest.fn().mockResolvedValue(null),
    ...overrides,
  };
}

describe('DecisionRecorder', () => {
  // Test 1: savePreliminary calls repo with the decision
  it('persists preliminary decision via repository', async () => {
    const repo = makeRepo();
    const recorder = new DecisionRecorder(repo);
    const decision = makePreliminary();

    await recorder.savePreliminary(decision);

    expect(repo.savePreliminary).toHaveBeenCalledTimes(1);
    expect(repo.savePreliminary).toHaveBeenCalledWith(decision);
  });

  // Test 2: updateConfirmed sets tripId + userChoice
  it('delegates updateConfirmed to repository with tripId and userChoice', async () => {
    const repo = makeRepo();
    const recorder = new DecisionRecorder(repo);

    // Simulate an existing preliminary decision found
    (repo.findByRequestId as jest.Mock).mockResolvedValue(makePreliminary({ requestId: 'req-001' }));

    await recorder.updateConfirmed('req-001', 'trip-42', 'original');

    expect(repo.updateConfirmed).toHaveBeenCalledWith('req-001', 'trip-42', 'original');
  });

  // Test 3: double-update on already-confirmed throws RequestAlreadyConfirmedError
  it('throws RequestAlreadyConfirmedError when confirming an already-confirmed decision', async () => {
    const repo = makeRepo();
    const recorder = new DecisionRecorder(repo);

    // First confirm succeeds
    (repo.findByRequestId as jest.Mock).mockResolvedValue(makePreliminary({ requestId: 'req-001' }));
    await recorder.updateConfirmed('req-001', 'trip-42', 'original');

    // Second confirm: repo.findByRequestId returns confirmed (tripId set)
    (repo.findByRequestId as jest.Mock).mockResolvedValue({
      ...makePreliminary({ requestId: 'req-001' }),
      tripId: 'trip-42',
      userChoice: 'original',
    } as PreliminaryDecision & { tripId: string; userChoice: string });

    await expect(recorder.updateConfirmed('req-001', 'trip-99', 'suggested')).rejects.toThrow(
      RequestAlreadyConfirmedError,
    );
  });

  // Test 4: savePreliminary by requestId — each call passes correct requestId
  it('passes the requestId from the decision to the repository', async () => {
    const repo = makeRepo();
    const recorder = new DecisionRecorder(repo);
    const decision = makePreliminary({ requestId: 'req-XYZ' });

    await recorder.savePreliminary(decision);

    const call = (repo.savePreliminary as jest.Mock).mock.calls[0][0] as PreliminaryDecision;
    expect(call.requestId).toBe('req-XYZ');
  });
});
