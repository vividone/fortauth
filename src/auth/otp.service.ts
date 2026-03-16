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

@Injectable()
export class OtpService {
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
    const otpHash = this.hashOtp(code);

    const otp = await this.otpRepo.findOne({
      where: { userId, otpHash, purpose, usedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });

    if (!otp || otp.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    // Mark as used (single-use)
    otp.usedAt = new Date();
    await this.otpRepo.save(otp);
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

}
