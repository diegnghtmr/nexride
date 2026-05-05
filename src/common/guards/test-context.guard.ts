import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { RbacForbiddenError } from '../errors/domain-error';

export const REQUIRED_ROLES_KEY = 'required_roles';
export const RequiredRoles = (...roles: string[]) => SetMetadata(REQUIRED_ROLES_KEY, roles);

@Injectable()
export class TestContextGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const isProduction = process.env['NODE_ENV'] === 'production';
    const isEnabled = process.env['TEST_CONTEXT_GUARD_ENABLED'] === 'true';

    if (isProduction || !isEnabled) {
      throw new RbacForbiddenError(
        isProduction ? 'Test context disabled in production' : 'TestContextGuard is not enabled',
      );
    }

    const req = ctx.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      user?: { id: string; role: string };
    }>();

    const id = req.headers['x-test-rider-id'];
    if (!id) {
      throw new RbacForbiddenError('Missing x-test-rider-id');
    }

    const role = req.headers['x-test-rider-role'] ?? 'rider';
    req.user = { id, role };

    return true;
  }
}
