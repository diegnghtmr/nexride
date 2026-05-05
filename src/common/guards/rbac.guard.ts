import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RbacForbiddenError } from '../errors/domain-error';
import { REQUIRED_ROLES_KEY } from './test-context.guard';

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[] | undefined>(REQUIRED_ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const req = ctx.switchToHttp().getRequest<{
      user?: { id: string; role: string };
    }>();

    const userRole = req.user?.role;
    if (!userRole || !requiredRoles.includes(userRole)) {
      throw new RbacForbiddenError(
        `Role '${userRole ?? 'unknown'}' is not permitted. Required: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}
