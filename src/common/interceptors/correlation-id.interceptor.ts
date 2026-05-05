import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { randomUUID } from 'crypto';

@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      correlationId?: string;
    }>();

    if (!req.correlationId) {
      const fromHeader = req.headers['x-request-id'] ?? req.headers['x-correlation-id'];
      req.correlationId = fromHeader ?? randomUUID();
    }

    return next.handle();
  }
}
