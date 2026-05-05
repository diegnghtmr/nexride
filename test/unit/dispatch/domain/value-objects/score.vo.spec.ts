import { Score } from '@dispatch/domain/value-objects/score.vo';

describe('Score VO', () => {
  describe('Score.of — factory validation', () => {
    it('accepts 0 (inclusive lower bound)', () => {
      const s = Score.of(0);
      expect(s.value).toBe(0);
    });

    it('accepts 1 (inclusive upper bound)', () => {
      const s = Score.of(1);
      expect(s.value).toBe(1);
    });

    it('accepts mid-range value 0.75', () => {
      const s = Score.of(0.75);
      expect(s.value).toBe(0.75);
    });

    it('rejects value below 0', () => {
      expect(() => Score.of(-0.0001)).toThrow();
    });

    it('rejects value above 1', () => {
      expect(() => Score.of(1.0001)).toThrow();
    });

    it('rejects NaN', () => {
      expect(() => Score.of(NaN)).toThrow();
    });
  });

  describe('weighted', () => {
    it('returns value * weight', () => {
      const s = Score.of(0.8);
      expect(s.weighted(0.25)).toBeCloseTo(0.2, 10);
    });

    it('returns 0 when score is 0', () => {
      expect(Score.of(0).weighted(0.5)).toBe(0);
    });

    it('returns weight when score is 1', () => {
      expect(Score.of(1).weighted(0.3)).toBeCloseTo(0.3, 10);
    });
  });
});
