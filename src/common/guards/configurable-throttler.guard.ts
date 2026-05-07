import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * ConfigurableThrottlerGuard — extends ThrottlerGuard with an env-based bypass.
 *
 * When `THROTTLER_DISABLED=1` is set in the process environment, all requests
 * are allowed through without rate-limit checks. This is intended exclusively
 * for integration test environments (REQ-FIX-V8-08).
 *
 * In production (THROTTLER_DISABLED unset or '0'), the guard behaves exactly
 * like the base ThrottlerGuard.
 */
@Injectable()
export class ConfigurableThrottlerGuard extends ThrottlerGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (process.env['THROTTLER_DISABLED'] === '1') {
      return true;
    }
    return super.canActivate(context);
  }
}
