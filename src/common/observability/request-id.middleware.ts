import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request & { correlationId?: string }, _res: Response, next: NextFunction): void {
    const fromHeader =
      (req.headers['x-request-id'] as string | undefined) ?? (req.headers['x-correlation-id'] as string | undefined);

    req.correlationId = fromHeader ?? randomUUID();
    next();
  }
}
