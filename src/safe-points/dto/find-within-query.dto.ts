import { IsNumber, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class FindWithinQueryDto {
  @Type(() => Number)
  @IsNumber()
  lat!: number;

  @Type(() => Number)
  @IsNumber()
  lng!: number;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  radiusM?: number = 120;
}
