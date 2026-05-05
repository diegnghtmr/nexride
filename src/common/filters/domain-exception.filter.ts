import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { DomainError } from '../errors/domain-error';

@Catch(DomainError)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(err: DomainError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<{
      status: (code: number) => { json: (body: unknown) => void };
    }>();
    const request = ctx.getRequest<{ correlationId?: string }>();

    response.status(err.httpStatus).json({
      code: err.code,
      message: err.message,
      meta: err.meta,
      requestId: request.correlationId ?? null,
    });
  }
}
