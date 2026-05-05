import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CandidateGenerator } from './domain/services/candidate-generator';
import { CandidateFilter } from './domain/services/candidate-filter';
import { loadDispatchConfig } from '../common/config/dispatch.config';
import { FLEET_SERVICE, IFleetService } from '../common/interfaces/IFleetService';
import { SAFE_POINTS_SERVICE, ISafePointsService } from '../common/interfaces/ISafePointsService';
import { FleetModule } from '../fleet/fleet.module';
import { SafePointsModule } from '../safe-points/safe-points.module';

export const CANDIDATE_GENERATOR = Symbol('CandidateGenerator');
export const CANDIDATE_FILTER = Symbol('CandidateFilter');

@Module({
  imports: [ConfigModule, FleetModule, SafePointsModule],
  providers: [
    {
      provide: CANDIDATE_FILTER,
      useFactory: () => {
        const cfg = loadDispatchConfig(process.env);
        return new CandidateFilter(cfg);
      },
    },
    {
      provide: CANDIDATE_GENERATOR,
      inject: [FLEET_SERVICE, SAFE_POINTS_SERVICE],
      useFactory: (fleetSvc: IFleetService, safePointsSvc: ISafePointsService) => {
        const cfg = loadDispatchConfig(process.env);
        return new CandidateGenerator(fleetSvc, safePointsSvc, cfg);
      },
    },
  ],
  exports: [CANDIDATE_GENERATOR, CANDIDATE_FILTER],
})
export class DispatchModule {}
