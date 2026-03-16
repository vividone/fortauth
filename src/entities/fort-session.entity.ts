import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { FortUser } from './fort-user.entity';

@Entity('fort_sessions')
export class FortSession {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  userId!: string;

  @Column('uuid', { nullable: true })
  refreshTokenId?: string;

  @Column({ nullable: true })
  ipAddress?: string;

  @Column({ nullable: true })
  userAgent?: string;

  @Column({ nullable: true })
  deviceName?: string;

  @Column({ type: 'timestamptz' })
  lastActiveAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt?: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  // ─── Relations ──────────────────────────────────────────
  @ManyToOne(() => FortUser, (u) => u.sessions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: FortUser;
}
