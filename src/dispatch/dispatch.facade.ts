import { Injectable, Inject } from '@nestjs/common';
import {
  EvaluateDispatchUseCase,
  EvaluateDispatchInput,
  EvaluateDispatchOutput,
} from './application/evaluate-dispatch.use-case';
import {
  ConfirmDispatchUseCase,
  ConfirmDispatchInput,
  ConfirmDispatchOutput,
} from './application/confirm-dispatch.use-case';

export const EVALUATE_DISPATCH_USE_CASE = Symbol('EvaluateDispatchUseCase');
export const CONFIRM_DISPATCH_USE_CASE = Symbol('ConfirmDispatchUseCase');

/**
 * DispatchFacade is the single public entry point for the Dispatch module.
 * It exposes evaluate (POST /rides/request) and confirm (POST /rides/confirm).
 * No other module should import from dispatch/application/** or dispatch/domain/**.
 */
@Injectable()
export class DispatchFacade {
  constructor(
    @Inject(EVALUATE_DISPATCH_USE_CASE) private readonly evaluateUseCase: EvaluateDispatchUseCase,
    @Inject(CONFIRM_DISPATCH_USE_CASE) private readonly confirmUseCase: ConfirmDispatchUseCase,
  ) {}

  async evaluate(input: EvaluateDispatchInput): Promise<EvaluateDispatchOutput> {
    return this.evaluateUseCase.execute(input);
  }

  async confirm(input: ConfirmDispatchInput): Promise<ConfirmDispatchOutput> {
    return this.confirmUseCase.execute(input);
  }
}
