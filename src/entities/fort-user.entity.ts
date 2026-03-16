import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  OneToOne,
} from 'typeorm';
import { FortRefreshToken } from './fort-refresh-token.entity';
import { FortSession } from './fort-session.entity';
import { FortApiKey } from './fort-api-key.entity';
import { FortOAuthAccount } from './fort-oauth-account.entity';
import { FortMfaSecret } from './fort-mfa-secret.entity';

@Entity('fort_users')
export class FortUser {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  email!: string;

  @Column({ nullable: true })
  passwordHash?: string;

  @Column()
  fullName!: string;

  @Column({ default: 'user' })
  role!: string;

  @Column('simple-array', { nullable: true })
  permissions?: string[];

  @Column({ default: true })
  isActive!: boolean;

  @Column({ default: false })
  isEmailVerified!: boolean;

  @Column({ default: false })
  isMfaEnabled!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  lockedUntil?: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  // ─── Relations ──────────────────────────────────────────
  @OneToMany(() => FortRefreshToken, (t) => t.user)
  refreshTokens!: FortRefreshToken[];

  @OneToMany(() => FortSession, (s) => s.user)
  sessions!: FortSession[];

  @OneToMany(() => FortApiKey, (k) => k.user)
  apiKeys!: FortApiKey[];

  @OneToMany(() => FortOAuthAccount, (o) => o.user)
  oauthAccounts!: FortOAuthAccount[];

  @OneToOne(() => FortMfaSecret, (m) => m.user)
  mfaSecret?: FortMfaSecret;
}
