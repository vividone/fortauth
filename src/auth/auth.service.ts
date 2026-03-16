import {
  Injectable,
  Inject,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash, randomBytes } from 'crypto';
import { FortUser } from '../entities/fort-user.entity';
import { FortPasswordReset } from '../entities/fort-password-reset.entity';
import { OtpPurpose } from '../entities/fort-otp.entity';
import { TokenService, TokenPair } from './token.service';
import { PasswordService } from './password.service';
import { OtpService } from './otp.service';
import { SessionsService } from '../sessions/sessions.service';
import { BruteForceService } from '../rate-limiting/brute-force.service';
import { FortAuthEventEmitter } from '../events/fort-auth-event-emitter';
import { FORTAUTH_OPTIONS } from '../constants';
import type { FortAuthOptions } from '../interfaces';
import { sanitizeUser } from '../utils/sanitize-user';
import {
  RegisterDto,
  LoginDto,
  UpdateProfileDto,
} from '../dto/auth.dto';

export interface LoginResult {
  accessToken?: string;
  refreshToken?: string;
  mfaRequired?: boolean;
  mfaToken?: string;
  user?: Partial<FortUser>;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(FortUser)
    private readonly userRepo: Repository<FortUser>,
    @InjectRepository(FortPasswordReset)
    private readonly passwordResetRepo: Repository<FortPasswordReset>,
    private readonly tokenService: TokenService,
    private readonly passwordService: PasswordService,
    private readonly otpService: OtpService,
    private readonly sessionsService: SessionsService,
    private readonly bruteForceService: BruteForceService,
    private readonly eventEmitter: FortAuthEventEmitter,
    @Inject(FORTAUTH_OPTIONS) private readonly options: FortAuthOptions,
  ) {}

  // ─── Create authenticated session (tokens + session) ───
  private async createAuthenticatedSession(
    user: FortUser,
    ip?: string,
    userAgent?: string,
  ): Promise<TokenPair> {
    const refreshToken = await this.tokenService.generateRefreshToken(user);
    const refreshTokenId = this.tokenService.extractRefreshTokenId(refreshToken);
    const session = await this.sessionsService.create(user.id, refreshTokenId, ip, userAgent);
    const accessToken = this.tokenService.generateAccessToken(user, session.id);
    return { accessToken, refreshToken };
  }

  // ─── Register ──────────────────────────────────────────
  async register(
    dto: RegisterDto,
    ip?: string,
    userAgent?: string,
  ): Promise<{ user: Partial<FortUser>; tokens: TokenPair }> {
    this.passwordService.validateStrength(dto.password);

    const existing = await this.userRepo.findOne({ where: { email: dto.email.toLowerCase() } });
    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }

    const passwordHash = await this.passwordService.hash(dto.password);
    const defaultRole = this.options.user?.defaultRole || 'user';

    const user = this.userRepo.create({
      email: dto.email.toLowerCase(),
      passwordHash,
      fullName: dto.fullName,
      role: defaultRole,
      isEmailVerified: !(this.options.user?.requireEmailVerification ?? true),
    });
    await this.userRepo.save(user);

    // Send verification OTP
    if (this.options.user?.requireEmailVerification ?? true) {
      const otp = await this.otpService.createOtp(user.id, OtpPurpose.EMAIL_VERIFICATION);
      await this.options.mailer.sendVerificationEmail(user.email, otp);
    }

    const tokens = await this.createAuthenticatedSession(user, ip, userAgent);
    const safe = sanitizeUser(user);
    this.eventEmitter.userRegistered(safe);

    return { user: safe, tokens };
  }

  // ─── Login ─────────────────────────────────────────────
  async login(dto: LoginDto, ip?: string, userAgent?: string): Promise<LoginResult> {
    const email = dto.email.toLowerCase();

    const user = await this.userRepo.findOne({
      where: { email },
    });

    if (!user || !user.passwordHash) {
      await this.bruteForceService.recordAttempt(email, ip || '0.0.0.0', false, 'invalid_credentials');
      this.eventEmitter.loginFailed({ email, reason: 'invalid_credentials', ip });
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      await this.bruteForceService.recordAttempt(email, ip || '0.0.0.0', false, 'account_disabled');
      this.eventEmitter.loginFailed({ email, reason: 'account_disabled', ip });
      throw new UnauthorizedException('Account is disabled');
    }

    // Check lockout
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const retryAfter = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 1000);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Account locked due to too many failed login attempts. Try again later.`,
          retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const valid = await this.passwordService.verify(dto.password, user.passwordHash);
    if (!valid) {
      await this.bruteForceService.recordAttempt(email, ip || '0.0.0.0', false, 'invalid_password');
      this.eventEmitter.loginFailed({ email, reason: 'invalid_password', ip });
      throw new UnauthorizedException('Invalid email or password');
    }

    // Record successful login
    await this.bruteForceService.recordAttempt(email, ip || '0.0.0.0', true);
    await this.bruteForceService.clearAttempts(email);

    // MFA check
    if (user.isMfaEnabled) {
      const mfaToken = this.tokenService.generateMfaToken(user.id);
      return { mfaRequired: true, mfaToken };
    }

    // Update last login
    user.lastLoginAt = new Date();
    user.lockedUntil = undefined;
    await this.userRepo.save(user);

    const tokens = await this.createAuthenticatedSession(user, ip, userAgent);
    this.eventEmitter.userLogin(user.id, { ip });

    return {
      ...tokens,
      user: sanitizeUser(user),
    };
  }

  // ─── Complete MFA Login ────────────────────────────────
  async completeMfaLogin(
    userId: string,
    ip?: string,
    userAgent?: string,
  ): Promise<LoginResult> {
    const user = await this.userRepo.findOneOrFail({ where: { id: userId } });
    user.lastLoginAt = new Date();
    user.lockedUntil = undefined;
    await this.userRepo.save(user);

    const tokens = await this.createAuthenticatedSession(user, ip, userAgent);
    this.eventEmitter.userLogin(user.id, { ip, mfa: true });

    return { ...tokens, user: sanitizeUser(user) };
  }

  // ─── Logout ────────────────────────────────────────────
  async logout(userId: string): Promise<void> {
    await this.tokenService.revokeAllForUser(userId);
    this.eventEmitter.userLogout(userId);
  }

  // ─── Refresh ───────────────────────────────────────────
  async refreshTokens(refreshToken: string): Promise<TokenPair> {
    const { tokenPair } = await this.tokenService.rotateRefreshToken(refreshToken);
    return tokenPair;
  }

  // ─── Verify Email ──────────────────────────────────────
  async verifyEmail(email: string, otp: string): Promise<void> {
    const user = await this.userRepo.findOne({
      where: { email: email.toLowerCase() },
    });
    if (!user) {
      throw new BadRequestException('Invalid or expired OTP');
    }
    if (user.isEmailVerified) {
      throw new BadRequestException('Email is already verified');
    }

    await this.otpService.verifyOtp(user.id, otp, OtpPurpose.EMAIL_VERIFICATION);
    await this.userRepo.update(user.id, { isEmailVerified: true });
    this.eventEmitter.userVerified(user.id);
  }

  // ─── Request Password Change OTP ─────────────────────
  async requestPasswordChangeOtp(userId: string): Promise<void> {
    const user = await this.userRepo.findOneOrFail({ where: { id: userId } });
    if (!user.passwordHash) {
      throw new BadRequestException(
        'Cannot change password for OAuth-only accounts',
      );
    }

    const otp = await this.otpService.createOtp(userId, OtpPurpose.PASSWORD_CHANGE);
    if (this.options.mailer.sendPasswordChangeOtp) {
      await this.options.mailer.sendPasswordChangeOtp(user.email, otp);
    }
  }

  // ─── Forgot Password ──────────────────────────────────
  async forgotPassword(email: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { email: email.toLowerCase() } });
    // Always return success to prevent email enumeration
    if (!user) return;

    const raw = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(raw).digest('hex');

    const reset = this.passwordResetRepo.create({
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    });
    await this.passwordResetRepo.save(reset);

    await this.options.mailer.sendPasswordResetEmail(user.email, raw);
  }

  // ─── Reset Password ───────────────────────────────────
  async resetPassword(token: string, newPassword: string): Promise<void> {
    this.passwordService.validateStrength(newPassword);

    const tokenHash = createHash('sha256').update(token).digest('hex');
    const reset = await this.passwordResetRepo.findOne({
      where: { tokenHash },
      relations: ['user'],
    });

    if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await this.passwordService.hash(newPassword);
    await this.userRepo.update(reset.userId, { passwordHash });

    reset.usedAt = new Date();
    await this.passwordResetRepo.save(reset);

    // Revoke all refresh tokens for security
    await this.tokenService.revokeAllForUser(reset.userId);
    this.eventEmitter.passwordChanged(reset.userId);
  }

  // ─── Change Password ──────────────────────────────────
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    otp: string,
  ): Promise<void> {
    this.passwordService.validateStrength(newPassword);

    const user = await this.userRepo.findOneOrFail({ where: { id: userId } });
    if (!user.passwordHash) {
      throw new BadRequestException(
        'Cannot change password for OAuth-only accounts',
      );
    }

    // Verify current password first (doesn't consume OTP if wrong)
    const valid = await this.passwordService.verify(currentPassword, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Verify OTP (consumed on success)
    await this.otpService.verifyOtp(userId, otp, OtpPurpose.PASSWORD_CHANGE);

    user.passwordHash = await this.passwordService.hash(newPassword);
    await this.userRepo.save(user);

    // Revoke all other refresh tokens
    await this.tokenService.revokeAllForUser(userId);
    this.eventEmitter.passwordChanged(userId);
  }

  // ─── Profile ───────────────────────────────────────────
  async getProfile(userId: string): Promise<Partial<FortUser>> {
    const user = await this.userRepo.findOneOrFail({ where: { id: userId } });
    return sanitizeUser(user);
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<Partial<FortUser>> {
    const user = await this.userRepo.findOneOrFail({ where: { id: userId } });

    if (dto.fullName) user.fullName = dto.fullName;
    if (dto.email) {
      const emailLower = dto.email.toLowerCase();
      if (emailLower !== user.email) {
        const existing = await this.userRepo.findOne({ where: { email: emailLower } });
        if (existing) throw new ConflictException('Email already in use');
        user.email = emailLower;
        user.isEmailVerified = false;
      }
    }

    await this.userRepo.save(user);
    return sanitizeUser(user);
  }

  // ─── Find user by ID (used by JWT strategy) ───────────
  async findById(userId: string): Promise<FortUser | null> {
    return this.userRepo.findOne({ where: { id: userId } });
  }
}
