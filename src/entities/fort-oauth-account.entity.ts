import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
} from 'typeorm';
import { FortUser } from './fort-user.entity';

@Entity('fort_oauth_accounts')
@Unique(['provider', 'providerUserId'])
export class FortOAuthAccount {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column('uuid')
  userId!: string;

  @Column()
  provider!: string;

  @Column()
  providerUserId!: string;

  @Column()
  email!: string;

  @Column({ nullable: true })
  displayName?: string;

  @Column({ nullable: true })
  avatarUrl?: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  // ─── Relations ──────────────────────────────────────────
  @ManyToOne(() => FortUser, (u) => u.oauthAccounts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: FortUser;
}
