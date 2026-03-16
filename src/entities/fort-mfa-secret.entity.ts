import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { FortUser } from './fort-user.entity';

@Entity('fort_mfa_secrets')
export class FortMfaSecret {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid', { unique: true })
  userId!: string;

  @Column()
  secret!: string;

  @Column('simple-array')
  backupCodes!: string[];

  @Column({ type: 'timestamptz', nullable: true })
  verifiedAt?: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  // ─── Relations ──────────────────────────────────────────
  @OneToOne(() => FortUser, (u) => u.mfaSecret, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: FortUser;
}
