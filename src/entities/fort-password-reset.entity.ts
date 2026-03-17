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

@Entity('fort_password_resets')
export class FortPasswordReset {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column('uuid')
  userId!: string;

  @Index()
  @Column()
  tokenHash!: string;

  @Column({ type: 'timestamptz', nullable: true })
  usedAt?: Date;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  // ─── Relations ──────────────────────────────────────────
  @ManyToOne(() => FortUser, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: FortUser;
}
