import { RequestId } from '@dispatch/domain/value-objects/request-id.vo';

describe('RequestId VO', () => {
  describe('RequestId.new', () => {
    it('generates a non-empty string', () => {
      const id = RequestId.new();
      expect(id.value.length).toBeGreaterThan(0);
    });

    it('generates unique values on each call', () => {
      const a = RequestId.new();
      const b = RequestId.new();
      expect(a.value).not.toBe(b.value);
    });

    it('generates valid UUID v4 format', () => {
      const id = RequestId.new();
      const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(uuidV4Regex.test(id.value)).toBe(true);
    });
  });

  describe('RequestId.from', () => {
    it('accepts a valid UUID v4', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const id = RequestId.from(uuid);
      expect(id.value).toBe(uuid);
    });

    it('rejects an empty string', () => {
      expect(() => RequestId.from('')).toThrow();
    });

    it('rejects a non-UUID string', () => {
      expect(() => RequestId.from('not-a-valid-uuid')).toThrow();
    });
  });
});
