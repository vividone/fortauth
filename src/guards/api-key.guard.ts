import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Inject,
  UnauthorizedException,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY, FORTAUTH_OPTIONS } from '../constants';
import type { FortAuthOptions } from '../interfaces';
import { ApiKeysService } from '../api-keys/api-keys.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(FORTAUTH_OPTIONS) private readonly options: FortAuthOptions,
    @Optional() private readonly apiKeysService?: ApiKeysService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Skip if route is public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // Skip if API keys are not enabled
    if (!this.options.apiKeys?.enabled) return true;

    const request = context.switchToHttp().getRequest();
    const headerName = this.options.apiKeys.headerName || 'x-api-key';
    const apiKey = request.headers[headerName];

    // If no API key in header, fall through (let JWT guard handle it)
    if (!apiKey) return true;

    if (!this.apiKeysService) {
      throw new UnauthorizedException('API key authentication is not available');
    }

    const user = await this.apiKeysService.validate(apiKey);
    if (!user) throw new UnauthorizedException('Invalid API key');

    request.user = user;
    return true;
  }
}
