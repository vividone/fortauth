import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not, In } from 'typeorm';
import { FortSession } from '../entities/fort-session.entity';
import { FortRefreshToken } from '../entities/fort-refresh-token.entity';
import { TokenService } from '../auth/token.service';
import { FortAuthEventEmitter } from '../events/fort-auth-event-emitter';
import { FORTAUTH_OPTIONS } from '../constants';
import type { FortAuthOptions } from '../interfaces';

@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(FortSession)
    private readonly sessionRepo: Repository<FortSession>,
    @InjectRepository(FortRefreshToken)
    private readonly refreshTokenRepo: Repository<FortRefreshToken>,
    private readonly tokenService: TokenService,
    private readonly eventEmitter: FortAuthEventEmitter,
    @Inject(FORTAUTH_OPTIONS) private readonly options: FortAuthOptions,
  ) {}

  async create(
    userId: string,
    refreshTokenId: string | undefined,
    ip?: string,
    userAgent?: string,
  ): Promise<FortSession> {
    const deviceName = userAgent ? this.parseDevice(userAgent) : undefined;

    const session = this.sessionRepo.create({
      userId,
      refreshTokenId,
      ipAddress: ip,
      userAgent,
      deviceName,
      lastActiveAt: new Date(),
    });
    await this.sessionRepo.save(session);

    // Enforce max sessions per user
    await this.enforceMax(userId);

    this.eventEmitter.sessionCreated(userId, { sessionId: session.id, ip, deviceName });
    return session;
  }

  async findActiveById(sessionId: string): Promise<FortSession | null> {
    return this.sessionRepo.findOne({
      where: { id: sessionId, revokedAt: IsNull() },
    });
  }

  async list(userId: string): Promise<FortSession[]> {
    return this.sessionRepo.find({
      where: { userId, revokedAt: IsNull() },
      order: { lastActiveAt: 'DESC' },
    });
  }

  async revoke(userId: string, sessionId: string): Promise<void> {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId, userId },
    });
    if (!session) throw new NotFoundException('Session not found');

    session.revokedAt = new Date();
    await this.sessionRepo.save(session);

    // Revoke the associated refresh token
    if (session.refreshTokenId) {
      await this.tokenService.revokeById(session.refreshTokenId);
    }

    this.eventEmitter.sessionRevoked(userId, { sessionId });
  }

  async revokeAll(userId: string, exceptSessionId?: string): Promise<void> {
    // Atomic bulk revocation using QueryBuilder
    const qb = this.sessionRepo
      .createQueryBuilder()
      .update(FortSession)
      .set({ revokedAt: new Date() })
      .where('userId = :userId', { userId })
      .andWhere('revokedAt IS NULL');

    if (exceptSessionId) {
      qb.andWhere('id != :exceptSessionId', { exceptSessionId });
    }

    await qb.execute();

    // Bulk-revoke all refresh tokens for this user
    await this.refreshTokenRepo
      .createQueryBuilder()
      .update(FortRefreshToken)
      .set({ isRevoked: true })
      .where('userId = :userId', { userId })
      .andWhere('isRevoked = false')
      .execute();
  }

  async updateLastActive(sessionId: string): Promise<void> {
    await this.sessionRepo.update(sessionId, { lastActiveAt: new Date() });
  }

  // ─── Helpers ───────────────────────────────────────────
  private async enforceMax(userId: string): Promise<void> {
    const max = this.options.sessions?.maxPerUser ?? 10;
    const sessions = await this.sessionRepo.find({
      where: { userId, revokedAt: IsNull() },
      order: { lastActiveAt: 'ASC' },
    });

    if (sessions.length > max) {
      const toRevoke = sessions.slice(0, sessions.length - max);
      const ids = toRevoke.map((s) => s.id);
      const refreshTokenIds = toRevoke
        .map((s) => s.refreshTokenId)
        .filter((id): id is string => !!id);

      // Bulk revoke sessions
      await this.sessionRepo
        .createQueryBuilder()
        .update(FortSession)
        .set({ revokedAt: new Date() })
        .where('id IN (:...ids)', { ids })
        .execute();

      // Bulk revoke associated refresh tokens
      if (refreshTokenIds.length > 0) {
        await this.refreshTokenRepo
          .createQueryBuilder()
          .update(FortRefreshToken)
          .set({ isRevoked: true })
          .where('id IN (:...ids)', { ids: refreshTokenIds })
          .execute();
      }
    }
  }

  private parseDevice(userAgent: string): string {
    // Simplified UA parsing
    if (/iPhone|iPad/i.test(userAgent)) return 'iOS Device';
    if (/Android/i.test(userAgent)) return 'Android Device';
    if (/Mac OS/i.test(userAgent)) return 'Mac';
    if (/Windows/i.test(userAgent)) return 'Windows PC';
    if (/Linux/i.test(userAgent)) return 'Linux';
    return 'Unknown Device';
  }
}
