import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateSafePointDto } from '../../../../src/safe-points/dto/update-safe-point.dto';

/**
 * Judgment 19° F1 — UpdateSafePointDto must enforce the same WGS-84 bounds
 * as CreateSafePointDto (closed in v0.1.19 / judgment 18° F5).
 *
 * The judgment 18° archive (engram #1213) flagged this exact gap as a
 * pending sweep: "DTO bounds gap se replica en otros DTOs… pendiente
 * sweep en próximo ciclo si reaparece". It reappeared.
 */
describe('UpdateSafePointDto — coordinate bounds (PATCH parity with POST)', () => {
  function build(location: { lat: unknown; lng: unknown }): UpdateSafePointDto {
    return plainToInstance(UpdateSafePointDto, {
      auditReason: 'updating coords',
      location,
    });
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
  ])('rejects %s on PATCH', async (_label, location) => {
    const dto = build(location);
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const nestedConstraints = errors[0]?.children?.[0]?.constraints ?? {};
    const constraintKeys = Object.keys(nestedConstraints);
    expect(constraintKeys.some((k) => k === 'min' || k === 'max')).toBe(true);
  });
});
