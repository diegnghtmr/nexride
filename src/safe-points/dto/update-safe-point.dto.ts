import { IsString, IsNumber, IsNotEmpty, Min, Max, ValidateNested, IsOptional, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

class LocationDto {
  @IsNumber()
  lat!: number;

  @IsNumber()
  lng!: number;
}

export class UpdateSafePointDto {
  /**
   * reason is REQUIRED for every update (audit trail).
   */
  @IsString()
  @IsNotEmpty()
  reason!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  zoneId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  safetyScore?: number;

  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';

  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  location?: LocationDto;
}
