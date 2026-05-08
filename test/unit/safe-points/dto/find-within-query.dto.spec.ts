import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { FindWithinQueryDto } from '../../../../src/safe-points/dto/find-within-query.dto';

/**
 * Judgment 19° F2/F3 — GET /safe-points/within query bounds.
 *
 * F2: lat/lng must be inside WGS-84 ranges (same contract as POST/PATCH DTOs).
 * F3: radiusM must be capped to prevent abusive scans against PostGIS
 *     (config default = 120m via DISPATCH_SAFE_POINT_RADIUS_M; we cap the
 *     query-string at 120m to mirror the dispatch contract).
 */
describe('FindWithinQueryDto — query bounds', () => {
  function build(qs: { lat: unknown; lng: unknown; radiusM?: unknown }): FindWithinQueryDto {
    return plainToInstance(FindWithinQueryDto, qs);
  }

  it('accepts a valid query', async () => {
    const dto = build({ lat: -34.6, lng: -58.4, radiusM: 100 });
    const errors = await validate(dto);
    expect(errors).toEqual([]);
  });

  it('accepts a valid query without radiusM (default = 120)', async () => {
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
  ])('rejects %s', async (_label, qs) => {
    const dto = build(qs);
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it.each([
    ['radiusM = 0', 0],
    ['radiusM negative', -1],
    ['radiusM above cap (120)', 121],
    ['radiusM abusive', 99_999_999],
  ])('rejects %s', async (_label, radiusM) => {
    const dto = build({ lat: 0, lng: 0, radiusM });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
