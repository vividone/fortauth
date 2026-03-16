import {
  Injectable,
  Inject,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

  async sendMagicLink(email: string): Promise<void> {
    const emailLower = email.toLowerCase();

    // Always send to prevent enumeration (but only actually send if user exists)
    const user = await this.userRepo.findOne({ where: { email: emailLower } });
    if (!user) return;

    const raw = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(raw).digest('hex');
    const expiryMs = parseDuration(this.options.magicLink?.tokenExpiry || '15m');

    const magicLink = this.magicLinkRepo.create({
      email: emailLower,
      tokenHash,
      expiresAt: new Date(Date.now() + expiryMs),
    });
    await this.magicLinkRepo.save(magicLink);

    const sendEmail = this.options.magicLink?.sendEmail;
    if (sendEmail) {
      await sendEmail(emailLower, raw, raw); // consumer builds the full URL
    }
  }

  async verify(
    token: string,
    ip?: string,
    userAgent?: string,
  ): Promise<{ user: Partial<FortUser>; tokens: TokenPair }> {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const magicLink = await this.magicLinkRepo.findOne({
      where: { tokenHash },
    });

    if (!magicLink || magicLink.usedAt || magicLink.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired magic link');
    }

    const user = await this.userRepo.findOne({
      where: { email: magicLink.email },
    });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Mark token as used
    magicLink.usedAt = new Date();
    await this.magicLinkRepo.save(magicLink);

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
    const accessToken = this.tokenService.generateAccessToken(user, session.id);

    this.eventEmitter.userLogin(user.id, { ip, method: 'magic_link' });

    return { user: sanitizeUser(user), tokens: { accessToken, refreshToken } };
  }
}
