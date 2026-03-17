import {
  Injectable,
  Inject,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, OptimisticLockVersionMismatchError } from 'typeorm';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { createHash, randomBytes } from 'crypto';
import { timingSafeCompare } from '../utils/timing-safe-compare';
import { FortMfaSecret } from '../entities/fort-mfa-secret.entity';
import { FortUser } from '../entities/fort-user.entity';
import { PasswordService } from '../auth/password.service';
import { FortAuthEventEmitter } from '../events/fort-auth-event-emitter';
import { FORTAUTH_OPTIONS } from '../constants';
import type { FortAuthOptions } from '../interfaces';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

@Injectable()
export class MfaService {
  private readonly backupAttempts = new Map<string, RateLimitEntry>();

  constructor(
    @InjectRepository(FortMfaSecret)
    private readonly mfaRepo: Repository<FortMfaSecret>,
    @InjectRepository(FortUser)
    private readonly userRepo: Repository<FortUser>,
    private readonly passwordService: PasswordService,
    private readonly eventEmitter: FortAuthEventEmitter,
    @Inject(FORTAUTH_OPTIONS) private readonly options: FortAuthOptions,
  ) {}

  async generateSecret(
    userId: string,
  ): Promise<{ secret: string; qrCodeUrl: string; backupCodes: string[] }> {
    const user = await this.userRepo.findOneOrFail({ where: { id: userId } });

    // Remove any existing unverified secret
    await this.mfaRepo.delete({ userId, verifiedAt: IsNull() as any });

    const secret = authenticator.generateSecret();
    const issuer = this.options.mfa?.issuer || 'FortAuth';
    const otpAuthUrl = authenticator.keyuri(user.email, issuer, secret);
    const qrCodeUrl = await QRCode.toDataURL(otpAuthUrl);

    const backupCodeCount = this.options.mfa?.backupCodeCount ?? 8;
    const rawBackupCodes = this.generateBackupCodes(backupCodeCount);
    const hashedCodes = rawBackupCodes.map((c) => this.hashCode(c));

    const mfaSecret = this.mfaRepo.create({
      userId,
      secret,
      backupCodes: hashedCodes,
    });
    await this.mfaRepo.save(mfaSecret);

    return {
      secret,
      qrCodeUrl,
      backupCodes: rawBackupCodes,
    };
  }

  async enableMfa(userId: string, totpCode: string): Promise<void> {
    const mfaSecret = await this.mfaRepo.findOne({
      where: { userId },
    });
    if (!mfaSecret) {
      throw new BadRequestException(
        'No MFA secret found. Call /mfa/setup first',
      );
    }
    if (mfaSecret.verifiedAt) {
      throw new BadRequestException('MFA is already enabled');
    }

    const isValid = authenticator.verify({
      token: totpCode,
      secret: mfaSecret.secret,
    });
    if (!isValid) {
      throw new BadRequestException('Invalid TOTP code');
    }

    mfaSecret.verifiedAt = new Date();
    await this.mfaRepo.save(mfaSecret);
    await this.userRepo.update(userId, { isMfaEnabled: true });
    this.eventEmitter.mfaEnabled(userId);
  }

  async verifyTotp(userId: string, code: string): Promise<boolean> {
    const mfaSecret = await this.mfaRepo.findOne({ where: { userId } });
    if (!mfaSecret || !mfaSecret.verifiedAt) return false;

    return authenticator.verify({ token: code, secret: mfaSecret.secret });
  }

  async verifyBackupCode(userId: string, code: string): Promise<boolean> {
    this.enforceBackupRateLimit(userId);

    const mfaSecret = await this.mfaRepo.findOne({ where: { userId } });
    if (!mfaSecret || !mfaSecret.verifiedAt) return false;

    const hashedInput = this.hashCode(code);
    const idx = mfaSecret.backupCodes.findIndex((stored) =>
      timingSafeCompare(stored, hashedInput),
    );
    if (idx === -1) {
      this.recordBackupAttempt(userId);
      return false;
    }

    // Consume the backup code with optimistic locking
    mfaSecret.backupCodes.splice(idx, 1);
    try {
      await this.mfaRepo.save(mfaSecret);
    } catch (err) {
      if (err instanceof OptimisticLockVersionMismatchError) {
        // Retry once: re-fetch and re-check
        return this.retryBackupCodeConsumption(userId, hashedInput);
      }
      throw err;
    }

    // Reset attempts on success
    this.backupAttempts.delete(userId);
    return true;
  }

  async disableMfa(userId: string, password: string): Promise<void> {
    const user = await this.userRepo.findOneOrFail({ where: { id: userId } });
    if (!user.passwordHash) {
      throw new BadRequestException('Cannot verify password for OAuth-only accounts');
    }

    const valid = await this.passwordService.verify(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid password');
    }

    await this.mfaRepo.delete({ userId });
    await this.userRepo.update(userId, { isMfaEnabled: false });
    this.eventEmitter.mfaDisabled(userId);
  }

  async regenerateBackupCodes(userId: string, password: string): Promise<string[]> {
    const user = await this.userRepo.findOneOrFail({ where: { id: userId } });
    if (!user.passwordHash) {
      throw new BadRequestException('Cannot verify password for OAuth-only accounts');
    }

    const valid = await this.passwordService.verify(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid password');
    }

    const mfaSecret = await this.mfaRepo.findOne({ where: { userId } });
    if (!mfaSecret || !mfaSecret.verifiedAt) {
      throw new NotFoundException('MFA is not enabled');
    }

    const backupCodeCount = this.options.mfa?.backupCodeCount ?? 8;
    const rawCodes = this.generateBackupCodes(backupCodeCount);
    mfaSecret.backupCodes = rawCodes.map((c) => this.hashCode(c));
    await this.mfaRepo.save(mfaSecret);

    return rawCodes;
  }

  // ─── Helpers ───────────────────────────────────────────
  private generateBackupCodes(count: number): string[] {
    return Array.from({ length: count }, () =>
      randomBytes(4).toString('hex').toUpperCase(),
    );
  }

  private hashCode(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }

  private async retryBackupCodeConsumption(
    userId: string,
    hashedInput: string,
  ): Promise<boolean> {
    const mfaSecret = await this.mfaRepo.findOne({ where: { userId } });
    if (!mfaSecret || !mfaSecret.verifiedAt) return false;

    const idx = mfaSecret.backupCodes.findIndex((stored) =>
      timingSafeCompare(stored, hashedInput),
    );
    if (idx === -1) return false;

    mfaSecret.backupCodes.splice(idx, 1);
    await this.mfaRepo.save(mfaSecret);
    this.backupAttempts.delete(userId);
    return true;
  }

  private enforceBackupRateLimit(userId: string): void {
    const maxAttempts = 5;
    const windowMs = 15 * 60 * 1000; // 15 minutes

    const entry = this.backupAttempts.get(userId);
    if (entry) {
      if (Date.now() > entry.resetAt) {
        this.backupAttempts.delete(userId);
      } else if (entry.count >= maxAttempts) {
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: 'Too many backup code attempts. Please try again later.',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }
  }

  private recordBackupAttempt(userId: string): void {
    const windowMs = 15 * 60 * 1000;
    const entry = this.backupAttempts.get(userId);

    if (entry && Date.now() <= entry.resetAt) {
      entry.count++;
    } else {
      this.backupAttempts.set(userId, { count: 1, resetAt: Date.now() + windowMs });
    }
  }
}
