import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { BruteForceService } from './brute-force.service';

@Injectable()
export class BruteForceGuard implements CanActivate {
  constructor(private readonly bruteForceService: BruteForceService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Only apply to login requests
    const path = request.route?.path || request.url || '';
    if (!path.includes('login')) return true;

    const email = request.body?.email;
    if (!email) return true;

    const { locked, retryAfter } = await this.bruteForceService.isLocked(email);
    if (locked) {
      const response = context.switchToHttp().getResponse();
      response.setHeader('Retry-After', String(retryAfter));
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Too many login attempts. Try again in ${retryAfter} seconds`,
          retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
