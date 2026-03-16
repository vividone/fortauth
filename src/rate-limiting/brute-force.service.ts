import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { FortLoginAttempt } from '../entities/fort-login-attempt.entity';
import { FortUser } from '../entities/fort-user.entity';
import { FortAuthEventEmitter } from '../events/fort-auth-event-emitter';
import { FORTAUTH_OPTIONS } from '../constants';
import type { FortAuthOptions } from '../interfaces';
import { parseDuration } from '../utils/parse-duration';

@Injectable()
export class BruteForceService {
  constructor(
    @InjectRepository(FortLoginAttempt)
    private readonly attemptRepo: Repository<FortLoginAttempt>,
    @InjectRepository(FortUser)
    private readonly userRepo: Repository<FortUser>,
    private readonly eventEmitter: FortAuthEventEmitter,
    @Inject(FORTAUTH_OPTIONS) private readonly options: FortAuthOptions,
  ) {}

  async recordAttempt(
    email: string,
    ipAddress: string,
    success: boolean,
    reason?: string,
  ): Promise<void> {
    const attempt = this.attemptRepo.create({
      email: email.toLowerCase(),
      ipAddress,
      success,
      reason,
    });
    await this.attemptRepo.save(attempt);

    // If failed, check if we should lock the account
    if (!success) {
      await this.checkAndLock(email.toLowerCase());
    }
  }

  async isLocked(email: string): Promise<{ locked: boolean; retryAfter?: number }> {
    const user = await this.userRepo.findOne({
      where: { email: email.toLowerCase() },
    });
    if (!user) return { locked: false };

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const retryAfter = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) / 1000,
      );
      return { locked: true, retryAfter };
    }

    return { locked: false };
  }

  async clearAttempts(email: string): Promise<void> {
    const user = await this.userRepo.findOne({
      where: { email: email.toLowerCase() },
    });
    if (user && user.lockedUntil) {
      user.lockedUntil = undefined;
      await this.userRepo.save(user);
    }
  }

  // ─── Private ───────────────────────────────────────────
  private async checkAndLock(email: string): Promise<void> {
    const maxAttempts = this.options.rateLimiting?.maxLoginAttempts ?? 5;
    const windowMs = parseDuration(this.options.rateLimiting?.windowDuration || '15m');
    const lockoutMs = parseDuration(this.options.rateLimiting?.lockoutDuration || '15m');

    const windowStart = new Date(Date.now() - windowMs);

    const recentFails = await this.attemptRepo.count({
      where: {
        email,
        success: false,
        createdAt: MoreThan(windowStart),
      },
    });

    if (recentFails >= maxAttempts) {
      await this.userRepo.update(
        { email },
        { lockedUntil: new Date(Date.now() + lockoutMs) },
      );
      const user = await this.userRepo.findOne({ where: { email } });
      if (user) {
        this.eventEmitter.accountLocked(user.id, { email });
      }
    }
  }

}
