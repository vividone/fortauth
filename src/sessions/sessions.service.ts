import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { FortSession } from '../entities/fort-session.entity';
import { TokenService } from '../auth/token.service';
import { FortAuthEventEmitter } from '../events/fort-auth-event-emitter';
import { FORTAUTH_OPTIONS } from '../constants';
import type { FortAuthOptions } from '../interfaces';

@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(FortSession)
    private readonly sessionRepo: Repository<FortSession>,
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
    const sessions = await this.sessionRepo.find({
      where: { userId, revokedAt: IsNull() },
    });

    for (const session of sessions) {
      if (exceptSessionId && session.id === exceptSessionId) continue;
      session.revokedAt = new Date();
      await this.sessionRepo.save(session);
      if (session.refreshTokenId) {
        await this.tokenService.revokeById(session.refreshTokenId);
      }
    }
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
      for (const session of toRevoke) {
        session.revokedAt = new Date();
        await this.sessionRepo.save(session);
        if (session.refreshTokenId) {
          await this.tokenService.revokeById(session.refreshTokenId);
        }
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
