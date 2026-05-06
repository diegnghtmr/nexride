import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PinoLogger } from 'nestjs-pino';
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
import { DispatchFacade, EVALUATE_DISPATCH_USE_CASE, CONFIRM_DISPATCH_USE_CASE } from './dispatch.facade';
import { EvaluateDispatchUseCase } from './application/evaluate-dispatch.use-case';
import { ConfirmDispatchUseCase } from './application/confirm-dispatch.use-case';
import { loadDispatchConfig } from '../common/config/dispatch.config';
import { FLEET_SERVICE, IFleetService } from '../common/interfaces/IFleetService';
import { SAFE_POINTS_SERVICE, ISafePointsService } from '../common/interfaces/ISafePointsService';
import { DISTANCE_PROVIDER } from '../common/interfaces/IDistanceProvider';
import { FLAG_PROVIDER } from '../common/interfaces/IFlagProvider';
import { DECISION_REPOSITORY } from '../common/interfaces/IDecisionRepository';
import { TRIP_SERVICE, ITripService } from '../common/interfaces/ITripService';
import { FleetModule } from '../fleet/fleet.module';
import { SafePointsModule } from '../safe-points/safe-points.module';
import { TripModule } from '../trip/trip.module';

export const CANDIDATE_GENERATOR = Symbol('CandidateGenerator');
export const CANDIDATE_FILTER = Symbol('CandidateFilter');
export const SCORING_ENGINE = Symbol('ScoringEngine');
export const DECISION_MAKER = Symbol('DecisionMaker');
export const FALLBACK_HANDLER = Symbol('FallbackHandler');
export const DECISION_RECORDER = Symbol('DecisionRecorder');

@Module({
  imports: [
    ConfigModule,
    FleetModule,
    SafePointsModule,
    TripModule,
    TypeOrmModule.forFeature([DispatchDecisionEntity]),
  ],
  providers: [
    // Infrastructure — concrete implementations
    DecisionRepository,
    {
      provide: DISTANCE_PROVIDER,
      useFactory: () => {
        const cfg = loadDispatchConfig(process.env);
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

    // Domain services
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

    // Application layer
    {
      provide: EVALUATE_DISPATCH_USE_CASE,
      inject: [
        CANDIDATE_GENERATOR,
        CANDIDATE_FILTER,
        SCORING_ENGINE,
        DECISION_MAKER,
        FALLBACK_HANDLER,
        DECISION_RECORDER,
        EventEmitter2,
        PinoLogger,
      ],
      useFactory: (
        candidateGenerator: CandidateGenerator,
        candidateFilter: CandidateFilter,
        scoringEngine: ScoringEngine,
        decisionMaker: DecisionMaker,
        fallbackHandler: FallbackHandler,
        decisionRecorder: DecisionRecorder,
        eventEmitter: EventEmitter2,
        logger: PinoLogger,
      ) => {
        const cfg = loadDispatchConfig(process.env);
        logger.setContext(EvaluateDispatchUseCase.name);
        return new EvaluateDispatchUseCase(
          candidateGenerator,
          candidateFilter,
          scoringEngine,
          decisionMaker,
          fallbackHandler,
          decisionRecorder,
          eventEmitter,
          cfg.pipelineTimeoutMs,
          logger,
        );
      },
    },
    {
      provide: CONFIRM_DISPATCH_USE_CASE,
      inject: [DECISION_REPOSITORY, TRIP_SERVICE, DataSource, EventEmitter2, PinoLogger],
      useFactory: (
        decisionRepo: DecisionRepository,
        tripService: ITripService,
        dataSource: DataSource,
        eventEmitter: EventEmitter2,
        logger: PinoLogger,
      ) => {
        logger.setContext(ConfirmDispatchUseCase.name);
        return new ConfirmDispatchUseCase(decisionRepo, tripService, dataSource, eventEmitter, logger);
      },
    },

    DispatchFacade,
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
    EVALUATE_DISPATCH_USE_CASE,
    CONFIRM_DISPATCH_USE_CASE,
    DispatchFacade,
  ],
})
export class DispatchModule {}
