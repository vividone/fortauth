import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { FORTAUTH_OPTIONS } from '../constants';
import type { FortAuthOptions } from '../interfaces';
import { AuthService } from '../auth/auth.service';
import { SessionsService } from '../sessions/sessions.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(FORTAUTH_OPTIONS) options: FortAuthOptions,
    private readonly authService: AuthService,
    private readonly sessionsService: SessionsService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: options.jwt.secret,
      ignoreExpiration: false,
    });
  }

  async validate(payload: { sub: string; email: string; role: string; sessionId?: string }) {
    const user = await this.authService.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException();
    }

    // Verify the session is still active (not revoked)
    if (payload.sessionId) {
      const session = await this.sessionsService.findActiveById(payload.sessionId);
      if (!session) {
        throw new UnauthorizedException('Session has been revoked');
      }
    }

    // Attach session info from JWT to the request user object
    return Object.assign(user, { sessionId: payload.sessionId });
  }
}
