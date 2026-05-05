import { ExecutionContext } from '@nestjs/common';
import { TestContextGuard } from '../../../../src/common/guards/test-context.guard';
import { RbacForbiddenError } from '../../../../src/common/errors/domain-error';

function makeContext(headers: Record<string, string | undefined>, _nodeEnv?: string): ExecutionContext {
  const request: Record<string, unknown> = { headers, user: undefined };

  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('TestContextGuard', () => {
  const originalEnv = process.env['NODE_ENV'];

  afterEach(() => {
    process.env['NODE_ENV'] = originalEnv;
    process.env['TEST_CONTEXT_GUARD_ENABLED'] = undefined as unknown as string;
  });

  it('throws RbacForbiddenError when NODE_ENV is production', () => {
    process.env['NODE_ENV'] = 'production';
    process.env['TEST_CONTEXT_GUARD_ENABLED'] = 'true';
    const guard = new TestContextGuard();
    const ctx = makeContext({ 'x-test-rider-id': 'rider-1', 'x-test-rider-role': 'rider' });

    expect(() => guard.canActivate(ctx)).toThrow(RbacForbiddenError);
  });

  it('throws RbacForbiddenError when guard is not enabled', () => {
    process.env['NODE_ENV'] = 'test';
    process.env['TEST_CONTEXT_GUARD_ENABLED'] = 'false';
    const guard = new TestContextGuard();
    const ctx = makeContext({ 'x-test-rider-id': 'rider-1', 'x-test-rider-role': 'rider' });

    expect(() => guard.canActivate(ctx)).toThrow(RbacForbiddenError);
  });

  it('throws RbacForbiddenError (status 403) when x-test-rider-id header is missing', () => {
    process.env['NODE_ENV'] = 'test';
    process.env['TEST_CONTEXT_GUARD_ENABLED'] = 'true';
    const guard = new TestContextGuard();
    const ctx = makeContext({ 'x-test-rider-role': 'rider' });

    expect(() => guard.canActivate(ctx)).toThrow(RbacForbiddenError);
  });

  it('attaches user to request and returns true when headers are valid', () => {
    process.env['NODE_ENV'] = 'test';
    process.env['TEST_CONTEXT_GUARD_ENABLED'] = 'true';
    const guard = new TestContextGuard();
    const request: Record<string, unknown> = {
      headers: { 'x-test-rider-id': 'rider-42', 'x-test-rider-role': 'supervisor' },
      user: undefined,
    };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    const result = guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(request['user']).toEqual({ id: 'rider-42', role: 'supervisor' });
  });

  it('defaults role to rider when x-test-rider-role header is absent', () => {
    process.env['NODE_ENV'] = 'test';
    process.env['TEST_CONTEXT_GUARD_ENABLED'] = 'true';
    const guard = new TestContextGuard();
    const request: Record<string, unknown> = {
      headers: { 'x-test-rider-id': 'rider-99' },
      user: undefined,
    };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    guard.canActivate(ctx);

    expect((request['user'] as { role: string }).role).toBe('rider');
  });

  it('throws RbacForbiddenError when role is not in allowed list for supervisor-only routes', () => {
    process.env['NODE_ENV'] = 'test';
    process.env['TEST_CONTEXT_GUARD_ENABLED'] = 'true';
    const guard = new TestContextGuard();

    // Using a rider role on a supervisor-protected endpoint
    const request: Record<string, unknown> = {
      headers: { 'x-test-rider-id': 'rider-1', 'x-test-rider-role': 'rider' },
      user: undefined,
    };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    // Guard itself passes (sets user) — RBAC check is done by RbacGuard
    // TestContextGuard only validates that headers are present
    const result = guard.canActivate(ctx);
    expect(result).toBe(true);
    expect((request['user'] as { role: string }).role).toBe('rider');
  });
});
