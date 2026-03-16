import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../constants';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPerms = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredPerms || requiredPerms.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user || !user.permissions) return false;

    return requiredPerms.every((p: string) => user.permissions.includes(p));
  }
}
