import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsEventEntity } from './infrastructure/analytics-event.entity';
import { DispatchAnalyticsHandler } from './handlers/dispatch.handler';

@Module({
  imports: [TypeOrmModule.forFeature([AnalyticsEventEntity])],
  providers: [DispatchAnalyticsHandler],
  exports: [],
})
export class AnalyticsModule {}
