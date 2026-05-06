import { Module } from '@nestjs/common';
import { Registry } from 'prom-client';
import { MetricsController, METRICS_REGISTRY } from './metrics.controller';
import { createMetricsRegistry } from './metrics.registry';

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
  ],
  exports: [METRICS_REGISTRY],
})
export class ObservabilityModule {}
