import { IsString, IsNumber, IsNotEmpty, Min, Max, ValidateNested, IsOptional, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class LocationDto {
  @IsNumber()
  lat!: number;

  @IsNumber()
  lng!: number;
}

export class UpdateSafePointDto {
  /**
   * auditReason is REQUIRED for every update — written to the audit log row.
   * This is the reason for THIS mutation, never stored in the catalog column.
   */
  @ApiProperty({ description: 'Mandatory. Why this mutation is happening — written to the audit log.' })
  @IsString()
  @IsNotEmpty()
  auditReason!: string;

  /**
   * reason is OPTIONAL — when provided, updates the catalog reason column
   * of the safe-point record (security justification of the safe-point itself).
   */
  @ApiProperty({ required: false, description: 'Optional. Updates the catalog reason column of the safe-point.' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  reason?: string;

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
