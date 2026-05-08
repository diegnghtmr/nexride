import { IsNumber, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Query string for GET /safe-points/within.
 *
 * Bounds are enforced at the HTTP boundary (judgment 19° F2+F3):
 * - lat/lng → WGS-84 ranges, same contract as Create/Update DTOs.
 * - radiusM → capped at 5000m (the maximum dispatch search horizon
 *   `DISPATCH_CANDIDATE_RADIUS_KM` = 5). Without the cap, a client could
 *   request radiusM=99_999_999 and force an abusive PostGIS scan.
 *   Default stays at 120m to match the safe-point dispatch radius
 *   (`DISPATCH_SAFE_POINT_RADIUS_M`); clients can request up to 5000m
 *   for ad-hoc queries.
 */
export class FindWithinQueryDto {
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(5000)
  radiusM?: number = 120;
}
