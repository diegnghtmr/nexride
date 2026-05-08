import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * ActivateSafePointDto — body for PATCH /safe-points/:id/activate
 * and PATCH /safe-points/:id/deactivate.
 *
 * F5 (v0.1.12-mvp): reason is mandatory for audit trail (mirrors deactivate semantics).
 */
export class ActivateSafePointDto {
  @ApiProperty({
    description: 'Audit reason for activation. Written to the safe_point_audit row.',
    example: 'Reactivado tras reparación de iluminación',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  reason!: string;
}
