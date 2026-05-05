import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CandidateGenerator } from './domain/services/candidate-generator';
import { CandidateFilter } from './domain/services/candidate-filter';
import { ScoringEngine } from './domain/services/scoring-engine';
import { DecisionMaker } from './domain/services/decision-maker';
import { FallbackHandler } from './domain/services/fallback-handler';
import { DecisionRecorder } from './domain/services/decision-recorder';
import { HaversineDistanceProvider } from './infrastructure/providers/haversine-distance.provider';
import { LocalFlagProvider } from './infrastructure/providers/local-flag.provider';
import { DecisionRepository } from './infrastructure/persistence/decision.repository';
import { DispatchDecisionEntity } from './infrastructure/persistence/dispatch-decision.entity';
import { loadDispatchConfig } from '../common/config/dispatch.config';
import { FLEET_SERVICE, IFleetService } from '../common/interfaces/IFleetService';
import { SAFE_POINTS_SERVICE, ISafePointsService } from '../common/interfaces/ISafePointsService';
import { DISTANCE_PROVIDER } from '../common/interfaces/IDistanceProvider';
import { FLAG_PROVIDER } from '../common/interfaces/IFlagProvider';
import { DECISION_REPOSITORY } from '../common/interfaces/IDecisionRepository';
import { FleetModule } from '../fleet/fleet.module';
import { SafePointsModule } from '../safe-points/safe-points.module';

export const CANDIDATE_GENERATOR = Symbol('CandidateGenerator');
export const CANDIDATE_FILTER = Symbol('CandidateFilter');
export const SCORING_ENGINE = Symbol('ScoringEngine');
export const DECISION_MAKER = Symbol('DecisionMaker');
export const FALLBACK_HANDLER = Symbol('FallbackHandler');
export const DECISION_RECORDER = Symbol('DecisionRecorder');

@Module({
  imports: [ConfigModule, FleetModule, SafePointsModule, TypeOrmModule.forFeature([DispatchDecisionEntity])],
  providers: [
    // Infrastructure — concrete implementations
    DecisionRepository,
    {
      provide: DISTANCE_PROVIDER,
      useFactory: () => {
        const cfg = loadDispatchConfig(process.env);
        // In production, inject a real Redis client via ConfigService.
        // For the module wiring stub, we defer Redis injection to application layer (Phase 5).
        // The provider is registered here so the token resolves.
        const stubRedis = {
          get: async () => null,
          setEx: async () => 'OK',
        };
        return new HaversineDistanceProvider(stubRedis, cfg);
      },
    },
    {
      provide: FLAG_PROVIDER,
      useFactory: () => {
        const cfg = loadDispatchConfig(process.env);
        return new LocalFlagProvider(cfg);
      },
    },
    {
      provide: DECISION_REPOSITORY,
      useExisting: DecisionRepository,
    },

    // Domain services — factory providers with plain DispatchConfig POJO
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
    {
      provide: SCORING_ENGINE,
      inject: [DISTANCE_PROVIDER],
      useFactory: (distanceProvider: InstanceType<typeof HaversineDistanceProvider>) => {
        const cfg = loadDispatchConfig(process.env);
        return new ScoringEngine(distanceProvider, cfg);
      },
    },
    {
      provide: DECISION_MAKER,
      useFactory: () => {
        const cfg = loadDispatchConfig(process.env);
        return new DecisionMaker(cfg);
      },
    },
    {
      provide: FALLBACK_HANDLER,
      inject: [FLEET_SERVICE],
      useFactory: (fleetSvc: IFleetService) => {
        const cfg = loadDispatchConfig(process.env);
        return new FallbackHandler(fleetSvc, cfg);
      },
    },
    {
      provide: DECISION_RECORDER,
      inject: [DECISION_REPOSITORY],
      useFactory: (repo: DecisionRepository) => {
        return new DecisionRecorder(repo);
      },
    },
  ],
  exports: [
    CANDIDATE_GENERATOR,
    CANDIDATE_FILTER,
    SCORING_ENGINE,
    DECISION_MAKER,
    FALLBACK_HANDLER,
    DECISION_RECORDER,
    DISTANCE_PROVIDER,
    FLAG_PROVIDER,
    DECISION_REPOSITORY,
  ],
})
export class DispatchModule {}
