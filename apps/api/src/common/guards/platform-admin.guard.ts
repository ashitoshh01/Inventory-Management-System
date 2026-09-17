import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';

/**
 * Guard that enforces platform-level administrator access.
 * Must be used AFTER JwtAuthGuard so that request.user is populated.
 *
 * This guard is independent from organization-level RBAC.
 * A user with isPlatformAdmin === true has platform admin access
 * regardless of their organization memberships.
 */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    if (!user.isPlatformAdmin) {
      throw new ForbiddenException('Platform administrator access required');
    }

    return true;
  }
}
