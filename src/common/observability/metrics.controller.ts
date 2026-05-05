import { Controller, Get, Inject, Res } from '@nestjs/common';
import { Response } from 'express';
import { Registry } from 'prom-client';

export const METRICS_REGISTRY = 'METRICS_REGISTRY';

@Controller('metrics')
export class MetricsController {
  constructor(@Inject(METRICS_REGISTRY) private readonly registry: Registry) {}

  @Get()
  async getMetrics(@Res() res: Response): Promise<void> {
    const metrics = await this.registry.metrics();
    res.set('Content-Type', this.registry.contentType);
    res.send(metrics);
  }
}
