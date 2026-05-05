import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsUUID } from 'class-validator';

export class ConfirmRideDto {
  @ApiProperty({ description: 'The requestId returned from POST /rides/request' })
  @IsUUID()
  requestId!: string;

  @ApiProperty({ enum: ['original', 'suggested'], description: 'Pickup choice' })
  @IsIn(['original', 'suggested'])
  choice!: 'original' | 'suggested';
}
