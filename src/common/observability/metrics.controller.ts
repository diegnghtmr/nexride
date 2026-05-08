import { Controller, Get, Inject, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Response } from 'express';
import { Registry } from 'prom-client';

export const METRICS_REGISTRY = 'METRICS_REGISTRY';

@Controller('metrics')
export class MetricsController {
  constructor(@Inject(METRICS_REGISTRY) private readonly registry: Registry) {}

  // Exempt from throttle: Prometheus scraping must not count toward per-user or per-IP buckets.
  // Burst probes during rolling deploys could otherwise trip the 100/min user throttler (D-003).
  // Judgment 17° F4: must list named throttlers explicitly — @SkipThrottle() default is
  // { default: true } which is a no-op against our 'user'/'ip' named throttlers (see
  // node_modules/@nestjs/throttler/dist/throttler.decorator.js:27).
  @SkipThrottle({ user: true, ip: true })
  @Get()
  async getMetrics(@Res() res: Response): Promise<void> {
    const metrics = await this.registry.metrics();
    res.set('Content-Type', this.registry.contentType);
    res.send(metrics);
  }
}
