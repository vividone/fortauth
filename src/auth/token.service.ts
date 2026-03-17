import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { createHash, randomBytes } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { FortRefreshToken } from '../entities/fort-refresh-token.entity';
import { FortUser } from '../entities/fort-user.entity';
import { FORTAUTH_OPTIONS } from '../constants';
import type { FortAuthOptions } from '../interfaces';
import { parseDuration } from '../utils/parse-duration';
import { timingSafeCompare } from '../utils/timing-safe-compare';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(FortRefreshToken)
    private readonly refreshTokenRepo: Repository<FortRefreshToken>,
    @Inject(FORTAUTH_OPTIONS) private readonly options: FortAuthOptions,
  ) {}

  // ─── Access Token ──────────────────────────────────────
  async generateAccessToken(user: FortUser, sessionId?: string): Promise<string> {
    const payload: Record<string, any> = {
      sub: user.id,
      email: user.email,
      role: user.role,
      permissions: user.permissions || [],
    };
    if (sessionId) {
      payload.sessionId = sessionId;
    }
    if (this.options.extendJwtPayload) {
      const custom = await this.options.extendJwtPayload(user);
      Object.assign(payload, custom);
    }
    return this.jwtService.sign(payload, {
      expiresIn: (this.options.jwt.accessTokenExpiry || '15m') as any,
    });
  }

  // ─── MFA Temp Token ────────────────────────────────────
  generateMfaToken(userId: string): string {
    return this.jwtService.sign(
      { sub: userId, mfa: true },
      { expiresIn: '5m' as any },
    );
  }

  verifyMfaToken(token: string): { sub: string } {
    try {
      const payload = this.jwtService.verify(token);
      if (!payload.mfa) throw new Error();
      return payload;
    } catch {
      throw new UnauthorizedException('Invalid or expired MFA token');
    }
  }

  // ─── Refresh Token ────────────────────────────────────
  async generateRefreshToken(
    user: FortUser,
    family?: string,
  ): Promise<string> {
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = this.computeRefreshExpiry();

    const entity = this.refreshTokenRepo.create({
      userId: user.id,
      tokenHash,
      family: family || uuidv4(),
      expiresAt,
    });
    await this.refreshTokenRepo.save(entity);

    // Encode: <id>.<rawToken> — the id lets us look up the row
    return `${entity.id}.${rawToken}`;
  }

  async generateTokenPair(
    user: FortUser,
    family?: string,
  ): Promise<TokenPair> {
    const accessToken = await this.generateAccessToken(user);
    const refreshToken = await this.generateRefreshToken(user, family);
    return { accessToken, refreshToken };
  }

  // ─── Validate + Rotate ─────────────────────────────────
  async rotateRefreshToken(
    rawRefreshToken: string,
  ): Promise<{ tokenPair: TokenPair; userId: string; newRefreshTokenId: string }> {
    const { id, token } = this.parseRefreshToken(rawRefreshToken);
    const tokenHash = this.hashToken(token);

    const existing = await this.refreshTokenRepo.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!existing) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Reuse detection: if the token is already revoked, revoke the entire family
    if (existing.isRevoked) {
      await this.revokeFamily(existing.family);
      throw new UnauthorizedException(
        'Refresh token reuse detected — all sessions in this family have been revoked',
      );
    }

    if (!timingSafeCompare(existing.tokenHash, tokenHash)) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (existing.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    // Revoke old token
    existing.isRevoked = true;
    await this.refreshTokenRepo.save(existing);

    // Issue new refresh token in the same family
    const newRefreshToken = await this.generateRefreshToken(existing.user, existing.family);
    const newRefreshTokenId = this.extractRefreshTokenId(newRefreshToken);

    // Generate access token (sessionId will be updated by caller if needed)
    const accessToken = await this.generateAccessToken(existing.user);

    return {
      tokenPair: { accessToken, refreshToken: newRefreshToken },
      userId: existing.userId,
      newRefreshTokenId,
    };
  }

  // ─── Revocation ────────────────────────────────────────
  async revokeFamily(family: string): Promise<void> {
    await this.refreshTokenRepo.update({ family }, { isRevoked: true });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.refreshTokenRepo.update({ userId }, { isRevoked: true });
  }

  async revokeById(tokenId: string): Promise<void> {
    await this.refreshTokenRepo.update(tokenId, { isRevoked: true });
  }

  // ─── Cleanup ───────────────────────────────────────────
  async cleanupExpired(): Promise<number> {
    const result = await this.refreshTokenRepo.delete({
      expiresAt: LessThan(new Date()),
    });
    return result.affected || 0;
  }

  // ─── Public Helpers ──────────────────────────────────────
  extractRefreshTokenId(rawRefreshToken: string): string {
    return this.parseRefreshToken(rawRefreshToken).id;
  }

  // ─── Private Helpers ────────────────────────────────────
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private parseRefreshToken(raw: string): { id: string; token: string } {
    const dotIdx = raw.indexOf('.');
    if (dotIdx === -1) {
      throw new UnauthorizedException('Malformed refresh token');
    }
    return { id: raw.slice(0, dotIdx), token: raw.slice(dotIdx + 1) };
  }

  private computeRefreshExpiry(): Date {
    const expiry = this.options.jwt.refreshTokenExpiry || '7d';
    const ms = parseDuration(expiry, 7 * 24 * 60 * 60 * 1000);
    return new Date(Date.now() + ms);
  }
}
