import { Injectable, Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';
import { FORTAUTH_OPTIONS } from '../../constants';
import type { FortAuthOptions } from '../../interfaces';
import type { OAuthProfile } from '../oauth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    @Inject(FORTAUTH_OPTIONS) options: FortAuthOptions,
  ) {
    const google = options.oauth?.google;
    super({
      clientID: google?.clientId || '',
      clientSecret: google?.clientSecret || '',
      callbackURL: google?.callbackUrl || '',
      scope: ['email', 'profile'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ) {
    const oauthProfile: OAuthProfile = {
      provider: 'google',
      providerUserId: profile.id,
      email: profile.emails?.[0]?.value || '',
      displayName: profile.displayName,
      avatarUrl: profile.photos?.[0]?.value,
    };
    done(null, oauthProfile);
  }
}
