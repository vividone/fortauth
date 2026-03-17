import {
  Injectable,
  Inject,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { createHash, randomBytes } from 'crypto';
import { FortMagicLink } from '../entities/fort-magic-link.entity';
import { FortUser } from '../entities/fort-user.entity';
import { TokenService, TokenPair } from '../auth/token.service';
import { SessionsService } from '../sessions/sessions.service';
import { FortAuthEventEmitter } from '../events/fort-auth-event-emitter';
import { FORTAUTH_OPTIONS } from '../constants';
import type { FortAuthOptions } from '../interfaces';
import { parseDuration } from '../utils/parse-duration';
import { sanitizeUser } from '../utils/sanitize-user';

@Injectable()
export class MagicLinkService {
  constructor(
    @InjectRepository(FortMagicLink)
    private readonly magicLinkRepo: Repository<FortMagicLink>,
    @InjectRepository(FortUser)
    private readonly userRepo: Repository<FortUser>,
    private readonly tokenService: TokenService,
    private readonly sessionsService: SessionsService,
    private readonly eventEmitter: FortAuthEventEmitter,
    @Inject(FORTAUTH_OPTIONS) private readonly options: FortAuthOptions,
  ) {}

  /**
   * Creates a magic link token without sending an email.
   * Returns the raw token string, or `null` if the user doesn't exist
   * (to prevent user enumeration).
   */
  async createMagicLink(email: string): Promise<string | null> {
    const emailLower = email.toLowerCase();

    const user = await this.userRepo.findOne({ where: { email: emailLower } });
    if (!user) return null;

    // Invalidate any existing unused tokens for this email
    await this.invalidateExistingTokens(emailLower);

    const raw = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(raw).digest('hex');
    const expiryMs = parseDuration(this.options.magicLink?.tokenExpiry || '15m');

    const magicLink = this.magicLinkRepo.create({
      email: emailLower,
      tokenHash,
      expiresAt: new Date(Date.now() + expiryMs),
    });
    await this.magicLinkRepo.save(magicLink);

    return raw;
  }

  /**
   * Creates a magic link token and sends it via the configured sendEmail callback.
   */
  async sendMagicLink(email: string): Promise<void> {
    const raw = await this.createMagicLink(email);
    if (!raw) return; // user not found — silent to prevent enumeration

    const sendEmail = this.options.magicLink?.sendEmail;
    if (sendEmail) {
      await sendEmail(email.toLowerCase(), raw);
    }
  }

  async verify(
    token: string,
    ip?: string,
    userAgent?: string,
  ): Promise<{ user: Partial<FortUser>; tokens: TokenPair }> {
    const tokenHash = createHash('sha256').update(token).digest('hex');

    // Atomic: mark as used only if valid and unused
    const result = await this.magicLinkRepo
      .createQueryBuilder()
      .update(FortMagicLink)
      .set({ usedAt: new Date() })
      .where('tokenHash = :tokenHash', { tokenHash })
      .andWhere('usedAt IS NULL')
      .andWhere('expiresAt > :now', { now: new Date() })
      .returning('email')
      .execute();

    if (!result.affected || result.affected === 0) {
      // Provide specific error message
      const existing = await this.magicLinkRepo.findOne({ where: { tokenHash } });
      if (!existing) {
        throw new BadRequestException('Invalid magic link');
      }
      if (existing.usedAt) {
        throw new BadRequestException('Magic link has already been used');
      }
      throw new BadRequestException('Magic link has expired');
    }

    const email = result.raw[0]?.email;
    const user = await this.userRepo.findOne({
      where: { email },
    });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Mark email as verified
    if (!user.isEmailVerified) {
      user.isEmailVerified = true;
      await this.userRepo.save(user);
    }

    user.lastLoginAt = new Date();
    await this.userRepo.save(user);

    // Create session with tokens
    const refreshToken = await this.tokenService.generateRefreshToken(user);
    const refreshTokenId = this.tokenService.extractRefreshTokenId(refreshToken);
    const session = await this.sessionsService.create(user.id, refreshTokenId, ip, userAgent);
    const accessToken = await this.tokenService.generateAccessToken(user, session.id);

    this.eventEmitter.userLogin(user.id, { ip, method: 'magic_link' });

    return { user: sanitizeUser(user), tokens: { accessToken, refreshToken } };
  }

  // ─── Helpers ───────────────────────────────────────────
  private async invalidateExistingTokens(email: string): Promise<void> {
    await this.magicLinkRepo.update(
      { email, usedAt: IsNull() as any },
      { usedAt: new Date() },
    );
  }
}
