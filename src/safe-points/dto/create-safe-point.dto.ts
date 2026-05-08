import { IsString, IsNumber, IsNotEmpty, Min, Max, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

class LocationDto {
  // WGS-84 bounds — enforced at the HTTP boundary so PostGIS never sees
  // out-of-range coordinates. Without these, lat=999 / lng=-181 would
  // bubble up as a 5xx from the DB instead of a 400 VALIDATION_ERROR.
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;
}

export class CreateSafePointDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  zoneId!: string;

  /**
   * reason is intentionally optional at DTO level so that missing/empty reason
   * reaches the service and triggers SafePointReasonRequiredError (domain code
   * SAFE_POINT_REASON_REQUIRED with httpStatus 400) — not NestJS's generic
   * validation 400.
   *
   * The service enforces the business rule; the domain error code is what the
   * API contract guarantees (design §6).
   */
  @IsOptional()
  @IsString()
  reason?: string;

  @IsNumber()
  @Min(0)
  @Max(1)
  safetyScore!: number;

  @ValidateNested()
  @Type(() => LocationDto)
  location!: LocationDto;
}
