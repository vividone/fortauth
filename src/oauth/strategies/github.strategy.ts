import { Injectable, Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-github2';
import { FORTAUTH_OPTIONS } from '../../constants';
import type { FortAuthOptions } from '../../interfaces';
import type { OAuthProfile } from '../oauth.service';

@Injectable()
export class GitHubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(
    @Inject(FORTAUTH_OPTIONS) options: FortAuthOptions,
  ) {
    const github = options.oauth?.github;
    super({
      clientID: github?.clientId || '',
      clientSecret: github?.clientSecret || '',
      callbackURL: github?.callbackUrl || '',
      scope: ['user:email'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: any,
    done: (err: any, user: any) => void,
  ) {
    const email =
      profile.emails?.[0]?.value || `${profile.username}@github.local`;

    const oauthProfile: OAuthProfile = {
      provider: 'github',
      providerUserId: profile.id,
      email,
      displayName: profile.displayName || profile.username,
      avatarUrl: profile.photos?.[0]?.value,
    };
    done(null, oauthProfile);
  }
}
