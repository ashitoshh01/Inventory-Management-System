import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true; // No permissions required
    }
    
    const request = context.switchToHttp().getRequest();
    const activeMembership = request.activeMembership;
    
    if (!activeMembership || !activeMembership.role || !activeMembership.role.permissions) {
      throw new ForbiddenException('No active membership or role found');
    }

    const userPermissions = activeMembership.role.permissions.map((rp: { permission: { action: string } }) => rp.permission.action);

    const hasAllRequired = requiredPermissions.every((perm) => userPermissions.includes(perm));
    
    if (!hasAllRequired) {
      throw new ForbiddenException(`Missing required permissions: ${requiredPermissions.join(', ')}`);
    }

    return true;
  }
}
