/**
 * TDD RED: DecisionRepository.savePreliminary emits logger.warn on 23505 duplicate skip.
 *
 * REQ-4 (Scenarios 4.1–4.3) — F9 v0.1.10-mvp
 *
 * These tests FAIL until logger is injected and wired in T-007 (GREEN commit).
 */
import { QueryFailedError } from 'typeorm';
import { DecisionRepository } from '../../../../src/dispatch/infrastructure/persistence/decision.repository';
import { PreliminaryDecision } from '../../../../src/common/interfaces/shared-types';

function buildDecision(overrides: Partial<PreliminaryDecision> = {}): PreliminaryDecision {
  return {
    requestId: 'req-test-001',
    riderId: 'rider-001',
    origin: { lat: 4.7109886, lng: -74.072092 },
    destination: { lat: 4.6482837, lng: -74.247971 },
    winnerVehicleId: 'vehicle-001',
    suggestedPointId: undefined,
    suggestedLocation: undefined,
    scoresJson: {},
    fallbackReason: undefined,
    suggestionStatus: 'not_shown',
    pipelineDurationMs: 100,
    ...overrides,
  };
}

function build23505Error(): QueryFailedError {
  const err = new QueryFailedError('INSERT INTO dispatch_decisions', [], new Error('duplicate key'));
  (err as unknown as Record<string, unknown>)['code'] = '23505';
  return err;
}

function buildGenericError(code: string): QueryFailedError {
  const err = new QueryFailedError('INSERT INTO dispatch_decisions', [], new Error('db error'));
  (err as unknown as Record<string, unknown>)['code'] = code;
  return err;
}

describe('DecisionRepository — 23505 idempotency warn log (REQ-4, F9)', () => {
  let mockRepo: { create: jest.Mock; save: jest.Mock };
  let mockLogger: { warn: jest.Mock; error: jest.Mock; log: jest.Mock; setContext: jest.Mock };
  let repository: DecisionRepository;

  beforeEach(() => {
    mockRepo = {
      create: jest.fn().mockImplementation((data) => ({ ...data })),
      save: jest.fn().mockResolvedValue(undefined),
    };

    mockLogger = {
      warn: jest.fn(),
      error: jest.fn(),
      log: jest.fn(),
      setContext: jest.fn(),
    };

    repository = new DecisionRepository(mockRepo as never, mockLogger as never);
  });

  describe('Scenario 4.1 — Warn fires once on 23505', () => {
    it('calls logger.warn exactly once with requestId and code when save throws 23505', async () => {
      mockRepo.save.mockRejectedValue(build23505Error());
      const decision = buildDecision();

      await repository.savePreliminary(decision);

      expect(mockLogger.warn).toHaveBeenCalledTimes(1);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        { requestId: decision.requestId, code: '23505' },
        'Preliminary decision idempotent skip — late pipeline write detected after abort guard',
      );
    });

    it('does not throw when save throws 23505', async () => {
      mockRepo.save.mockRejectedValue(build23505Error());

      await expect(repository.savePreliminary(buildDecision())).resolves.toBeUndefined();
    });
  });

  describe('Scenario 4.2 — Non-23505 errors still re-throw', () => {
    it('re-throws when save throws a non-23505 QueryFailedError', async () => {
      mockRepo.save.mockRejectedValue(buildGenericError('23000'));

      await expect(repository.savePreliminary(buildDecision())).rejects.toBeInstanceOf(QueryFailedError);
    });

    it('does NOT call logger.warn on non-23505 error', async () => {
      mockRepo.save.mockRejectedValue(buildGenericError('23000'));

      try {
        await repository.savePreliminary(buildDecision());
      } catch {
        // expected
      }

      expect(mockLogger.warn).not.toHaveBeenCalled();
    });
  });

  describe('Scenario 4.3 — Logger not called on happy path', () => {
    it('does NOT call logger.warn when save succeeds', async () => {
      mockRepo.save.mockResolvedValue(undefined);

      await repository.savePreliminary(buildDecision());

      expect(mockLogger.warn).not.toHaveBeenCalled();
    });
  });
});
