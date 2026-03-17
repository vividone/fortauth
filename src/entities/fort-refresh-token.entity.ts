import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { FortUser } from './fort-user.entity';

@Entity('fort_refresh_tokens')
export class FortRefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column('uuid')
  userId!: string;

  @Column()
  tokenHash!: string;

  @Index()
  @Column('uuid')
  family!: string;

  @Column({ default: false })
  isRevoked!: boolean;

  @Index()
  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  // ─── Relations ──────────────────────────────────────────
  @ManyToOne(() => FortUser, (u) => u.refreshTokens, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: FortUser;
}
