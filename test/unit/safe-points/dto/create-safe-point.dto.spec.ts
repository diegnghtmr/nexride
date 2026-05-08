import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateSafePointDto } from '../../../../src/safe-points/dto/create-safe-point.dto';

/**
 * Judgment 18° F5 — DTO bounds for geographic coordinates.
 *
 * The HTTP boundary must reject lat/lng outside the WGS-84 valid ranges
 * (lat ∈ [-90, 90], lng ∈ [-180, 180]) before they reach PostGIS. Without
 * @Min/@Max, the DB layer is the only thing rejecting these values, which
 * (a) leaks 5xx instead of 400 and (b) violates the contract that
 * ValidationPipe is the single source of truth for input validation.
 */
describe('CreateSafePointDto — coordinate bounds', () => {
  const validBase = {
    name: 'Plaza Constitución',
    zoneId: 'zone-1',
    safetyScore: 0.8,
  };

  function build(location: { lat: unknown; lng: unknown }): CreateSafePointDto {
    return plainToInstance(CreateSafePointDto, { ...validBase, location });
  }

  it('accepts coordinates inside WGS-84 ranges', async () => {
    const dto = build({ lat: -34.6, lng: -58.4 });
    const errors = await validate(dto);
    expect(errors).toEqual([]);
  });

  it.each([
    ['lat above max', { lat: 91, lng: 0 }],
    ['lat below min', { lat: -91, lng: 0 }],
    ['lng above max', { lat: 0, lng: 181 }],
    ['lng below min', { lat: 0, lng: -181 }],
    ['lat NaN-like (999)', { lat: 999, lng: 0 }],
  ])('rejects %s', async (_label, location) => {
    const dto = build(location);
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const nestedConstraints = errors[0]?.children?.[0]?.constraints ?? {};
    const constraintKeys = Object.keys(nestedConstraints);
    expect(constraintKeys.some((k) => k === 'min' || k === 'max')).toBe(true);
  });
});
