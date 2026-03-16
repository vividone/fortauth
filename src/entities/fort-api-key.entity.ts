import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { FortUser } from './fort-user.entity';

@Entity('fort_api_keys')
export class FortApiKey {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  userId!: string;

  @Column()
  name!: string;

  @Column({ length: 12 })
  keyPrefix!: string;

  @Column()
  keyHash!: string;

  @Column('simple-array', { nullable: true })
  scopes?: string[];

  @Column({ type: 'timestamptz', nullable: true })
  lastUsedAt?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt?: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  // ─── Relations ──────────────────────────────────────────
  @ManyToOne(() => FortUser, (u) => u.apiKeys, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: FortUser;
}
