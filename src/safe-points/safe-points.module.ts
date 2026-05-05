import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SafePointsController } from './safe-points.controller';
import { SafePointsService } from './safe-points.service';
import { SafePointsRepository } from './infrastructure/safe-points.repository';
import { SafePointEntity } from './infrastructure/safe-point.entity';
import { SafePointAuditEntity } from './infrastructure/safe-point-audit.entity';
import { SAFE_POINTS_SERVICE } from '../common/interfaces/ISafePointsService';

@Module({
  imports: [TypeOrmModule.forFeature([SafePointEntity, SafePointAuditEntity])],
  controllers: [SafePointsController],
  providers: [
    SafePointsRepository,
    SafePointsService,
    {
      provide: SAFE_POINTS_SERVICE,
      useExisting: SafePointsService,
    },
  ],
  exports: [SafePointsService, SAFE_POINTS_SERVICE],
})
export class SafePointsModule {}
