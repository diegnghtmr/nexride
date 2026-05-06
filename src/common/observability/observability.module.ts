import { Module } from '@nestjs/common';
import { Registry } from 'prom-client';
import { MetricsController, METRICS_REGISTRY } from './metrics.controller';
import { createMetricsRegistry, DispatchMetrics } from './metrics.registry';

// DI token for the structured DispatchMetrics object (REQ-OBS-5, ADR-3)
export const DISPATCH_METRICS = Symbol('DISPATCH_METRICS');

@Module({
  controllers: [MetricsController],
  providers: [
    {
      provide: METRICS_REGISTRY,
      useFactory: (): Registry => {
        const { registry } = createMetricsRegistry();
        return registry;
      },
    },
    {
      provide: DISPATCH_METRICS,
      useFactory: (): DispatchMetrics => {
        const { metrics } = createMetricsRegistry();
        return metrics;
      },
    },
  ],
  exports: [METRICS_REGISTRY, DISPATCH_METRICS],
})
export class ObservabilityModule {}
