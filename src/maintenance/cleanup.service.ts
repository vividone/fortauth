import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, Not, IsNull } from 'typeorm';
import { FortRefreshToken } from '../entities/fort-refresh-token.entity';
import { FortOtp } from '../entities/fort-otp.entity';
import { FortMagicLink } from '../entities/fort-magic-link.entity';
import { FortPasswordReset } from '../entities/fort-password-reset.entity';
import { FortLoginAttempt } from '../entities/fort-login-attempt.entity';
import { FortSession } from '../entities/fort-session.entity';

export interface CleanupResult {
  refreshTokens: number;
  otps: number;
  magicLinks: number;
  passwordResets: number;
  loginAttempts: number;
  sessions: number;
}

@Injectable()
export class CleanupService {
  constructor(
    @InjectRepository(FortRefreshToken)
    private readonly refreshTokenRepo: Repository<FortRefreshToken>,
    @InjectRepository(FortOtp)
    private readonly otpRepo: Repository<FortOtp>,
    @InjectRepository(FortMagicLink)
    private readonly magicLinkRepo: Repository<FortMagicLink>,
    @InjectRepository(FortPasswordReset)
    private readonly passwordResetRepo: Repository<FortPasswordReset>,
    @InjectRepository(FortLoginAttempt)
    private readonly loginAttemptRepo: Repository<FortLoginAttempt>,
    @InjectRepository(FortSession)
    private readonly sessionRepo: Repository<FortSession>,
  ) {}

  /**
   * Remove all expired/used data across all FortAuth tables.
   * Call this periodically (e.g. via a cron job) to prevent table bloat.
   */
  async cleanupAll(): Promise<CleanupResult> {
    const now = new Date();

    const [
      refreshTokens,
      otps,
      magicLinks,
      passwordResets,
      loginAttempts,
      sessions,
    ] = await Promise.all([
      this.cleanupRefreshTokens(now),
      this.cleanupOtps(now),
      this.cleanupMagicLinks(now),
      this.cleanupPasswordResets(now),
      this.cleanupLoginAttempts(now),
      this.cleanupSessions(now),
    ]);

    return { refreshTokens, otps, magicLinks, passwordResets, loginAttempts, sessions };
  }

  private async cleanupRefreshTokens(now: Date): Promise<number> {
    // Delete expired tokens and revoked tokens older than 7 days
    const expiredResult = await this.refreshTokenRepo.delete({
      expiresAt: LessThan(now),
    });
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const revokedResult = await this.refreshTokenRepo
      .createQueryBuilder()
      .delete()
      .where('isRevoked = true')
      .andWhere('createdAt < :date', { date: sevenDaysAgo })
      .execute();
    return (expiredResult.affected || 0) + (revokedResult.affected || 0);
  }

  private async cleanupOtps(now: Date): Promise<number> {
    // Delete used OTPs and expired OTPs
    const usedResult = await this.otpRepo.delete({
      usedAt: Not(IsNull()) as any,
    });
    const expiredResult = await this.otpRepo.delete({
      expiresAt: LessThan(now),
    });
    return (usedResult.affected || 0) + (expiredResult.affected || 0);
  }

  private async cleanupMagicLinks(now: Date): Promise<number> {
    // Delete used magic links and expired magic links
    const usedResult = await this.magicLinkRepo.delete({
      usedAt: Not(IsNull()) as any,
    });
    const expiredResult = await this.magicLinkRepo.delete({
      expiresAt: LessThan(now),
    });
    return (usedResult.affected || 0) + (expiredResult.affected || 0);
  }

  private async cleanupPasswordResets(now: Date): Promise<number> {
    // Delete used resets and expired resets
    const usedResult = await this.passwordResetRepo.delete({
      usedAt: Not(IsNull()) as any,
    });
    const expiredResult = await this.passwordResetRepo.delete({
      expiresAt: LessThan(now),
    });
    return (usedResult.affected || 0) + (expiredResult.affected || 0);
  }

  private async cleanupLoginAttempts(now: Date): Promise<number> {
    // Delete login attempts older than 30 days
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const result = await this.loginAttemptRepo.delete({
      createdAt: LessThan(thirtyDaysAgo),
    });
    return result.affected || 0;
  }

  private async cleanupSessions(now: Date): Promise<number> {
    // Delete revoked sessions older than 30 days
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const result = await this.sessionRepo
      .createQueryBuilder()
      .delete()
      .where('revokedAt IS NOT NULL')
      .andWhere('revokedAt < :date', { date: thirtyDaysAgo })
      .execute();
    return result.affected || 0;
  }
}
