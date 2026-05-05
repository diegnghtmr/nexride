import { DecisionMaker, ScoredCombo, DispatchDecisionDraft } from '../../../../src/dispatch/domain/services/decision-maker';
import { loadDispatchConfig } from '../../../../src/common/config/dispatch.config';

function makeCombo(overrides: Partial<ScoredCombo> = {}): ScoredCombo {
  return {
    vehicleId: 'VH-001',
    safePointId: null,
    proximity: 0.6,
    energy: 0.8,
    safety: 0.3,
    continuity: 0.6,
    total: 0.575,
    etaSeconds: 240,
    walkingMeters: 0,
    ...overrides,
  };
}

const defaultCfg = loadDispatchConfig({});

describe('DecisionMaker', () => {
  // Test 1: Safety improvement <15% → no suggestion
  it('does not generate suggestion when improvement is below 15%', () => {
    const maker = new DecisionMaker(defaultCfg);
    const originalSafety = 0.3;
    // Use a value strictly less than 15% improvement (14.9%): 0.3 * 1.149 = 0.3447
    const suggestedSafety = originalSafety * (1 + defaultCfg.suggestionThresholdPct - 0.001); // 14.9%
    const originalCombo = makeCombo({ vehicleId: 'VH-001', safePointId: null, safety: originalSafety, total: 0.55 });
    const suggestedCombo = makeCombo({
      vehicleId: 'VH-001',
      safePointId: 'SP-001',
      safety: suggestedSafety,
      walkingMeters: 80,
      total: 0.56,
    });
    const result: DispatchDecisionDraft = maker.decide([originalCombo, suggestedCombo]);
    expect(result.suggestion).toBeUndefined();
    expect(result.primary.vehicleId).toBe('VH-001');
  });

  // Test 2: Safety improvement exactly 15% → suggestion shown
  it('generates suggestion when improvement is exactly 15%', () => {
    const maker = new DecisionMaker(defaultCfg);
    // Use exact arithmetic: originalSafety * 1.15 to avoid floating-point drift
    const originalSafety = 0.3;
    const suggestedSafety = originalSafety * (1 + defaultCfg.suggestionThresholdPct); // exact 15%
    const originalCombo = makeCombo({ vehicleId: 'VH-001', safePointId: null, safety: originalSafety, total: 0.55 });
    const suggestedCombo = makeCombo({
      vehicleId: 'VH-001',
      safePointId: 'SP-001',
      safety: suggestedSafety,
      walkingMeters: 80,
      total: 0.56,
    });
    const result = maker.decide([originalCombo, suggestedCombo]);
    expect(result.suggestion).toBeDefined();
    expect(result.suggestion!.safePointId).toBe('SP-001');
  });

  // Test 3: Walking >120m → no suggestion despite high improvement
  it('does not generate suggestion when walking distance exceeds safePointRadiusM', () => {
    const maker = new DecisionMaker(defaultCfg); // safePointRadiusM = 120
    const originalCombo = makeCombo({ vehicleId: 'VH-001', safePointId: null, safety: 0.3 });
    const suggestedCombo = makeCombo({
      vehicleId: 'VH-001',
      safePointId: 'SP-001',
      safety: 0.8, // huge improvement
      walkingMeters: 121, // > 120m → no suggestion
      total: 0.65,
    });
    const result = maker.decide([originalCombo, suggestedCombo]);
    expect(result.suggestion).toBeUndefined();
  });

  // Test 4: No safe points → primary = vehicle + no suggestion
  it('returns primary vehicle with no suggestion when no safe-point combos exist', () => {
    const maker = new DecisionMaker(defaultCfg);
    const combo = makeCombo({ vehicleId: 'VH-001', safePointId: null, total: 0.55 });
    const result = maker.decide([combo]);
    expect(result.primary.vehicleId).toBe('VH-001');
    expect(result.suggestion).toBeUndefined();
  });

  // Test 5: Single candidate → returned as primary
  it('returns single viable candidate as primary without error', () => {
    const maker = new DecisionMaker(defaultCfg);
    const combo = makeCombo({ vehicleId: 'VH-SOLO', safePointId: null, total: 0.42 });
    const result = maker.decide([combo]);
    expect(result.primary.vehicleId).toBe('VH-SOLO');
    expect(result.primary.total).toBeCloseTo(0.42, 6);
  });

  // Test 6: Tie on total → tiebreak by vehicleId ASC
  it('breaks tie on equal total by vehicleId ASC', () => {
    const maker = new DecisionMaker(defaultCfg);
    const comboA = makeCombo({ vehicleId: 'VH-B', safePointId: null, total: 0.6 });
    const comboB = makeCombo({ vehicleId: 'VH-A', safePointId: null, total: 0.6 }); // same total, lower id
    const result = maker.decide([comboA, comboB]);
    expect(result.primary.vehicleId).toBe('VH-A');
  });

  // Test: Tie on vehicleId + different safePointId → tiebreak by safePointId ASC (null sorts last)
  it('breaks vehicleId tie by safePointId ASC, null sorts after non-null', () => {
    const maker = new DecisionMaker(defaultCfg);
    const comboA = makeCombo({ vehicleId: 'VH-A', safePointId: 'SP-002', total: 0.6, safety: 0.3 });
    const comboB = makeCombo({ vehicleId: 'VH-A', safePointId: null, total: 0.6, safety: 0.3 });
    const result = maker.decide([comboA, comboB]);
    // SP-002 < null: SP-002 wins
    expect(result.primary.safePointId).toBe('SP-002');
  });

  // Test: empty combos → throws
  it('throws when combos array is empty', () => {
    const maker = new DecisionMaker(defaultCfg);
    expect(() => maker.decide([])).toThrow();
  });

  // Test: two non-null safePointIds with same vehicleId + total → sorted alphabetically
  it('breaks tie between two non-null safePointIds alphabetically', () => {
    const maker = new DecisionMaker(defaultCfg);
    const comboA = makeCombo({ vehicleId: 'VH-A', safePointId: 'SP-002', total: 0.6, safety: 0.3 });
    const comboB = makeCombo({ vehicleId: 'VH-A', safePointId: 'SP-001', total: 0.6, safety: 0.3 });
    const result = maker.decide([comboA, comboB]);
    // SP-001 < SP-002 alphabetically → SP-001 wins
    expect(result.primary.safePointId).toBe('SP-001');
  });

  // Test: walking exactly 120m → no suggestion (exclusive upper boundary per spec)
  it('does not suggest when walkingMeters is exactly 120 (exclusive upper boundary)', () => {
    const maker = new DecisionMaker(defaultCfg);
    const originalCombo = makeCombo({ vehicleId: 'VH-001', safePointId: null, safety: 0.3 });
    const suggestedCombo = makeCombo({
      vehicleId: 'VH-001',
      safePointId: 'SP-001',
      safety: 0.345, // exactly 15% improvement
      walkingMeters: 120, // exactly at limit — per spec: must be < 120 (< safePointRadiusM)
      total: 0.56,
    });
    const result = maker.decide([originalCombo, suggestedCombo]);
    expect(result.suggestion).toBeUndefined();
  });
});
