import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsEventEntity } from './infrastructure/analytics-event.entity';
import { DispatchAnalyticsHandler } from './handlers/dispatch.handler';
import { ObservabilityModule } from '../common/observability/observability.module';

@Module({
  imports: [TypeOrmModule.forFeature([AnalyticsEventEntity]), ObservabilityModule],
  providers: [DispatchAnalyticsHandler],
  exports: [],
})
export class AnalyticsModule {}
