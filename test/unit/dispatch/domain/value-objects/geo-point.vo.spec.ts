import { GeoPoint } from '@dispatch/domain/value-objects/geo-point.vo';

describe('GeoPoint VO', () => {
  describe('GeoPoint.of — factory validation', () => {
    it('creates a valid GeoPoint for known coordinates', () => {
      const point = GeoPoint.of(4.65, -74.05);
      expect(point.lat).toBe(4.65);
      expect(point.lng).toBe(-74.05);
    });

    it('accepts lat boundary -90', () => {
      expect(() => GeoPoint.of(-90, 0)).not.toThrow();
    });

    it('accepts lat boundary +90', () => {
      expect(() => GeoPoint.of(90, 0)).not.toThrow();
    });

    it('accepts lng boundary -180', () => {
      expect(() => GeoPoint.of(0, -180)).not.toThrow();
    });

    it('accepts lng boundary +180', () => {
      expect(() => GeoPoint.of(0, 180)).not.toThrow();
    });

    it('rejects lat below -90', () => {
      expect(() => GeoPoint.of(-90.0001, 0)).toThrow();
    });

    it('rejects lat above +90', () => {
      expect(() => GeoPoint.of(90.0001, 0)).toThrow();
    });

    it('rejects lng below -180', () => {
      expect(() => GeoPoint.of(0, -180.0001)).toThrow();
    });

    it('rejects lng above +180', () => {
      expect(() => GeoPoint.of(0, 180.0001)).toThrow();
    });
  });

  describe('distanceKmHaversine', () => {
    it('returns 0 for identical points', () => {
      const p = GeoPoint.of(4.65, -74.05);
      expect(p.distanceKmHaversine(p)).toBeCloseTo(0, 5);
    });

    it('computes ~111 km between 0°0 and 1°0 (1 degree latitude)', () => {
      const a = GeoPoint.of(0, 0);
      const b = GeoPoint.of(1, 0);
      expect(a.distanceKmHaversine(b)).toBeCloseTo(111.195, 0);
    });

    it('is symmetric — distance(a,b) === distance(b,a)', () => {
      const a = GeoPoint.of(4.65, -74.05);
      const b = GeoPoint.of(4.7, -74.06);
      expect(a.distanceKmHaversine(b)).toBeCloseTo(b.distanceKmHaversine(a), 10);
    });
  });
});
