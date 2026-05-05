import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsUUID, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class GeoPointDto {
  @ApiProperty({ example: 4.65, description: 'Latitude' })
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @ApiProperty({ example: -74.05, description: 'Longitude' })
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;
}

export class RequestRideDto {
  @ApiProperty({ type: GeoPointDto, description: 'Origin coordinates' })
  @ValidateNested()
  @Type(() => GeoPointDto)
  origin!: GeoPointDto;

  @ApiProperty({ type: GeoPointDto, description: 'Destination coordinates' })
  @ValidateNested()
  @Type(() => GeoPointDto)
  destination!: GeoPointDto;

  @ApiPropertyOptional({ description: 'Optional correlation ID' })
  @IsOptional()
  @IsUUID()
  correlationId?: string;
}
