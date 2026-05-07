/**
 * ConfigurableThrottlerGuard — Unit Tests (T-003 · RED · F3)
 *
 * Strict TDD: This file is the RED commit — written BEFORE the `getTracker`
 * override is added to ConfigurableThrottlerGuard.
 *
 * Verifies that `getTracker(req)` returns `req.user.id` when authenticated,
 * falls back to `req.ip` when user is absent or user.id is falsy, and never
 * throws on unauthenticated requests.
 *
 * No NestJS container needed — unit test in pure isolation.
 */

import { Reflector } from '@nestjs/core';
import { ThrottlerStorage } from '@nestjs/throttler';
import { ConfigurableThrottlerGuard } from '../../../../src/common/guards/configurable-throttler.guard';

/**
 * Expose the protected `getTracker` method for testing.
 */
class TestableThrottlerGuard extends ConfigurableThrottlerGuard {
  async callGetTracker(req: Record<string, unknown>): Promise<string> {
    return this.getTracker(req);
  }
}

describe('ConfigurableThrottlerGuard.getTracker', () => {
  let guard: TestableThrottlerGuard;

  beforeEach(() => {
    // Minimal mocks — only the constructor parameters are needed.
    // getTracker does not use storage or reflector.
    const mockOptions = [
      { name: 'user', ttl: 60_000, limit: 100 },
      { name: 'ip', ttl: 60_000, limit: 1000 },
    ];
    const mockStorage = {} as ThrottlerStorage;
    const mockReflector = {} as Reflector;

    guard = new TestableThrottlerGuard(mockOptions as never, mockStorage, mockReflector);
  });

  it('returns req.user.id when user is authenticated and id is truthy', async () => {
    const req = { user: { id: 'u-1' }, ip: '1.2.3.4' };
    const tracker = await guard.callGetTracker(req);
    expect(tracker).toBe('u-1');
  });

  it('returns req.ip when user is absent (unauthenticated)', async () => {
    const req = { ip: '1.2.3.4' };
    const tracker = await guard.callGetTracker(req);
    expect(tracker).toBe('1.2.3.4');
  });

  it('returns req.ip when user.id is undefined (falsy id fallback)', async () => {
    const req = { user: { id: undefined }, ip: '1.2.3.4' };
    const tracker = await guard.callGetTracker(req);
    expect(tracker).toBe('1.2.3.4');
  });

  it('does not throw on unauthenticated requests', async () => {
    const req = { ip: '10.0.0.1' };
    await expect(guard.callGetTracker(req)).resolves.not.toThrow();
  });
});
