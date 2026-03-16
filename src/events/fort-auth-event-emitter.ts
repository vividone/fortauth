import { Injectable, Optional } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { FortAuthEvent } from './fort-auth-events';
import type { FortUser } from '../entities/fort-user.entity';

export interface FortAuthEventPayload {
  event: FortAuthEvent;
  userId?: string;
  user?: Partial<FortUser>;
  metadata?: Record<string, any>;
  timestamp: Date;
}

@Injectable()
export class FortAuthEventEmitter {
  constructor(
    @Optional() private readonly eventEmitter?: EventEmitter2,
  ) {}

  emit(
    event: FortAuthEvent,
    data: Omit<FortAuthEventPayload, 'event' | 'timestamp'>,
  ): void {
    if (!this.eventEmitter) return;

    const payload: FortAuthEventPayload = {
      event,
      ...data,
      timestamp: new Date(),
    };

    this.eventEmitter.emit(event, payload);
  }

  // ─── Convenience methods ───────────────────────────────
  userRegistered(user: Partial<FortUser>): void {
    this.emit(FortAuthEvent.USER_REGISTERED, {
      userId: user.id,
      user,
    });
  }

  userVerified(userId: string): void {
    this.emit(FortAuthEvent.USER_VERIFIED, { userId });
  }

  userLogin(userId: string, metadata?: Record<string, any>): void {
    this.emit(FortAuthEvent.USER_LOGIN, { userId, metadata });
  }

  userLogout(userId: string): void {
    this.emit(FortAuthEvent.USER_LOGOUT, { userId });
  }

  passwordChanged(userId: string): void {
    this.emit(FortAuthEvent.USER_PASSWORD_CHANGED, { userId });
  }

  mfaEnabled(userId: string): void {
    this.emit(FortAuthEvent.USER_MFA_ENABLED, { userId });
  }

  mfaDisabled(userId: string): void {
    this.emit(FortAuthEvent.USER_MFA_DISABLED, { userId });
  }

  sessionCreated(userId: string, metadata?: Record<string, any>): void {
    this.emit(FortAuthEvent.SESSION_CREATED, { userId, metadata });
  }

  sessionRevoked(userId: string, metadata?: Record<string, any>): void {
    this.emit(FortAuthEvent.SESSION_REVOKED, { userId, metadata });
  }

  loginFailed(metadata: Record<string, any>): void {
    this.emit(FortAuthEvent.LOGIN_FAILED, { metadata });
  }

  accountLocked(userId: string, metadata?: Record<string, any>): void {
    this.emit(FortAuthEvent.ACCOUNT_LOCKED, { userId, metadata });
  }
}
