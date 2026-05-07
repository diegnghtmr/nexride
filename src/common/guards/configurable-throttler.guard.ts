import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * ConfigurableThrottlerGuard — extends ThrottlerGuard with two behaviours:
 *
 * 1. Env-based bypass: when `THROTTLER_DISABLED=1` is set in the process
 *    environment, all requests are allowed through without rate-limit checks.
 *    This is intended exclusively for integration test environments (REQ-FIX-V8-08).
 *
 * 2. Custom tracker (NFR-17 / F3): `getTracker(req)` returns the authenticated
 *    user's id (`req.user?.id`) when present and truthy, falling back to `req.ip`
 *    for unauthenticated requests. This enables per-user throttling for the `user`
 *    named throttler and per-IP throttling for the `ip` named throttler — both
 *    throttlers receive the same key from this single function; each maintains its
 *    own independent bucket.
 *
 * Escape hatches available per route:
 *   @SkipThrottle({ user: true, ip: true }) — skip all named throttlers
 *   @Throttle({ user: { limit: N, ttl: T } }) — override per named throttler
 *
 * In production (THROTTLER_DISABLED unset or '0'), the guard runs BOTH named
 * throttlers registered in ThrottlerModule.forRoot and enforces whichever trips
 * first (user: 100/min, ip: 1000/min by default).
 */
@Injectable()
export class ConfigurableThrottlerGuard extends ThrottlerGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (process.env['THROTTLER_DISABLED'] === '1') {
      return true;
    }
    return super.canActivate(context);
  }

  /**
   * Tracker key derivation — called once per request by the base ThrottlerGuard.
   * The same key is used across ALL named throttlers; each throttler maintains
   * its own independent bucket for that key.
   *
   * - Authenticated: returns `req.user.id` (JWT userId set by TestContextGuard / future JwtAuthGuard)
   * - Unauthenticated: returns `req.ip` (never throws, never returns undefined)
   */
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const user = req['user'] as { id?: unknown } | undefined;
    const userId = user?.id;
    if (userId) {
      return userId as string;
    }
    return (req['ip'] as string | undefined) ?? 'anonymous';
  }
}
