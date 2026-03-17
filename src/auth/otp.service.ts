import {
  Injectable,
  Inject,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, MoreThan } from 'typeorm';
import { createHash, randomInt } from 'crypto';
import { FortOtp, OtpPurpose } from '../entities/fort-otp.entity';
import { FORTAUTH_OPTIONS } from '../constants';
import type { FortAuthOptions } from '../interfaces';
import { parseDuration } from '../utils/parse-duration';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

@Injectable()
export class OtpService {
  private readonly verifyAttempts = new Map<string, RateLimitEntry>();

  constructor(
    @InjectRepository(FortOtp)
    private readonly otpRepo: Repository<FortOtp>,
    @Inject(FORTAUTH_OPTIONS) private readonly options: FortAuthOptions,
  ) {}

  /**
   * Generate a 6-digit numeric OTP, store its hash, and return the raw code.
   * Invalidates any previous unused OTPs for the same user + purpose.
   */
  async createOtp(userId: string, purpose: OtpPurpose): Promise<string> {
    await this.enforceRateLimit(userId, purpose);

    const code = this.generateCode();
    const otpHash = this.hashOtp(code);
    const expiryMs = parseDuration(this.options.otp?.expiry || '10m', 10 * 60 * 1000);

    // Invalidate any existing unused OTPs for the same user + purpose
    await this.otpRepo.update(
      { userId, purpose, usedAt: IsNull() },
      { usedAt: new Date() },
    );

    const otp = this.otpRepo.create({
      userId,
      otpHash,
      purpose,
      expiresAt: new Date(Date.now() + expiryMs),
    });
    await this.otpRepo.save(otp);

    return code;
  }

  /**
   * Verify a 6-digit OTP code for a given user and purpose.
   * Marks the OTP as used on success. Throws on failure.
   */
  async verifyOtp(
    userId: string,
    code: string,
    purpose: OtpPurpose,
  ): Promise<void> {
    this.enforceVerifyRateLimit(userId, purpose);

    const otpHash = this.hashOtp(code);

    // Atomic: mark as used only if it's valid and unused
    const result = await this.otpRepo
      .createQueryBuilder()
      .update(FortOtp)
      .set({ usedAt: new Date() })
      .where('userId = :userId', { userId })
      .andWhere('otpHash = :otpHash', { otpHash })
      .andWhere('purpose = :purpose', { purpose })
      .andWhere('usedAt IS NULL')
      .andWhere('expiresAt > :now', { now: new Date() })
      .execute();

    if (!result.affected || result.affected === 0) {
      this.recordVerifyAttempt(userId, purpose);
      throw new BadRequestException('Invalid or expired OTP');
    }

    // Reset verify attempts on success
    this.verifyAttempts.delete(`${userId}:${purpose}`);
  }

  // ─── Private helpers ──────────────────────────────────────

  private generateCode(): string {
    // crypto.randomInt is cryptographically secure
    return String(randomInt(0, 1_000_000)).padStart(6, '0');
  }

  private hashOtp(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }

  private async enforceRateLimit(
    userId: string,
    purpose: OtpPurpose,
  ): Promise<void> {
    const maxRequests = this.options.otp?.maxRequestsPerWindow ?? 5;
    const windowMs = parseDuration(this.options.otp?.windowDuration || '15m');
    const windowStart = new Date(Date.now() - windowMs);

    const recentCount = await this.otpRepo.count({
      where: {
        userId,
        purpose,
        createdAt: MoreThan(windowStart),
      },
    });

    if (recentCount >= maxRequests) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many OTP requests. Please try again later.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private enforceVerifyRateLimit(userId: string, purpose: OtpPurpose): void {
    const key = `${userId}:${purpose}`;
    const maxAttempts = this.options.otp?.maxVerifyAttempts ?? 5;
    const windowMs = parseDuration(this.options.otp?.verifyWindowDuration || '15m');

    const entry = this.verifyAttempts.get(key);
    if (entry) {
      if (Date.now() > entry.resetAt) {
        this.verifyAttempts.delete(key);
      } else if (entry.count >= maxAttempts) {
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: 'Too many verification attempts. Please try again later.',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }
  }

  private recordVerifyAttempt(userId: string, purpose: OtpPurpose): void {
    const key = `${userId}:${purpose}`;
    const windowMs = parseDuration(this.options.otp?.verifyWindowDuration || '15m');
    const entry = this.verifyAttempts.get(key);

    if (entry && Date.now() <= entry.resetAt) {
      entry.count++;
    } else {
      this.verifyAttempts.set(key, { count: 1, resetAt: Date.now() + windowMs });
    }
  }
}
