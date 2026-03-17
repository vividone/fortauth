import {
  Injectable,
  Inject,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FortOAuthAccount } from '../entities/fort-oauth-account.entity';
import { FortUser } from '../entities/fort-user.entity';
import { TokenService, TokenPair } from '../auth/token.service';
import { SessionsService } from '../sessions/sessions.service';
import { FortAuthEventEmitter } from '../events/fort-auth-event-emitter';
import { FORTAUTH_OPTIONS } from '../constants';
import type { FortAuthOptions } from '../interfaces';
import { sanitizeUser } from '../utils/sanitize-user';

export interface OAuthProfile {
  provider: string;
  providerUserId: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
}

@Injectable()
export class OAuthService {
  constructor(
    @InjectRepository(FortOAuthAccount)
    private readonly oauthRepo: Repository<FortOAuthAccount>,
    @InjectRepository(FortUser)
    private readonly userRepo: Repository<FortUser>,
    private readonly tokenService: TokenService,
    private readonly sessionsService: SessionsService,
    private readonly eventEmitter: FortAuthEventEmitter,
    @Inject(FORTAUTH_OPTIONS) private readonly options: FortAuthOptions,
  ) {}

  async handleCallback(
    profile: OAuthProfile,
    ip?: string,
    userAgent?: string,
  ): Promise<{ user: Partial<FortUser>; tokens: TokenPair }> {
    // Check if this OAuth account already exists
    let oauthAccount = await this.oauthRepo.findOne({
      where: {
        provider: profile.provider,
        providerUserId: profile.providerUserId,
      },
      relations: ['user'],
    });

    if (oauthAccount) {
      // Existing OAuth user — issue tokens
      const user = oauthAccount.user;
      user.lastLoginAt = new Date();
      await this.userRepo.save(user);
      const tokens = await this.createSessionAndTokens(user, ip, userAgent);
      this.eventEmitter.userLogin(user.id, { ip, method: 'oauth', provider: profile.provider });
      return { user: sanitizeUser(user), tokens };
    }

    // Check if a user with this email already exists (link accounts)
    let user = await this.userRepo.findOne({
      where: { email: profile.email.toLowerCase() },
    });

    if (!user) {
      // Create new user
      const defaultRole = this.options.user?.defaultRole || 'user';
      user = this.userRepo.create({
        email: profile.email.toLowerCase(),
        fullName: profile.displayName || profile.email.split('@')[0],
        role: defaultRole,
        isEmailVerified: true, // OAuth emails are pre-verified
        isActive: true,
      });
      await this.userRepo.save(user);
    }

    // Create OAuth account link
    oauthAccount = this.oauthRepo.create({
      userId: user.id,
      provider: profile.provider,
      providerUserId: profile.providerUserId,
      email: profile.email,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
    });
    await this.oauthRepo.save(oauthAccount);

    user.lastLoginAt = new Date();
    await this.userRepo.save(user);

    const tokens = await this.createSessionAndTokens(user, ip, userAgent);
    this.eventEmitter.userLogin(user.id, { ip, method: 'oauth', provider: profile.provider });
    return { user: sanitizeUser(user), tokens };
  }

  async linkAccount(userId: string, profile: OAuthProfile): Promise<void> {
    const existing = await this.oauthRepo.findOne({
      where: {
        provider: profile.provider,
        providerUserId: profile.providerUserId,
      },
    });
    if (existing) {
      throw new ConflictException('This OAuth account is already linked');
    }

    const account = this.oauthRepo.create({
      userId,
      ...profile,
    });
    await this.oauthRepo.save(account);
  }

  async unlinkAccount(userId: string, provider: string): Promise<void> {
    const account = await this.oauthRepo.findOne({
      where: { userId, provider },
    });
    if (!account) throw new NotFoundException('OAuth account not found');

    // Ensure user still has a way to log in (password or another OAuth)
    const user = await this.userRepo.findOneOrFail({ where: { id: userId } });
    const otherOAuth = await this.oauthRepo.count({
      where: { userId },
    });
    if (!user.passwordHash && otherOAuth <= 1) {
      throw new ConflictException(
        'Cannot unlink the only authentication method. Set a password first.',
      );
    }

    await this.oauthRepo.remove(account);
  }

  private async createSessionAndTokens(
    user: FortUser,
    ip?: string,
    userAgent?: string,
  ): Promise<TokenPair> {
    const refreshToken = await this.tokenService.generateRefreshToken(user);
    const refreshTokenId = this.tokenService.extractRefreshTokenId(refreshToken);
    const session = await this.sessionsService.create(user.id, refreshTokenId, ip, userAgent);
    const accessToken = await this.tokenService.generateAccessToken(user, session.id);
    return { accessToken, refreshToken };
  }
}
