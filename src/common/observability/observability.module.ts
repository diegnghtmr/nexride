import { Module } from '@nestjs/common';
import { Registry } from 'prom-client';
import { MetricsController, METRICS_REGISTRY } from './metrics.controller';
import { getOrCreateMetricsRegistry, DispatchMetrics } from './metrics.registry';

// DI token for the structured DispatchMetrics object (REQ-OBS-5, ADR-3)
export const DISPATCH_METRICS = Symbol('DISPATCH_METRICS');

@Module({
  controllers: [MetricsController],
  providers: [
    {
      provide: METRICS_REGISTRY,
      useFactory: (): Registry => {
        const { registry } = getOrCreateMetricsRegistry();
        return registry;
      },
    },
    {
      provide: DISPATCH_METRICS,
      useFactory: (): DispatchMetrics => {
        const { metrics } = getOrCreateMetricsRegistry();
        return metrics;
      },
    },
  ],
  exports: [METRICS_REGISTRY, DISPATCH_METRICS],
})
export class ObservabilityModule {}
