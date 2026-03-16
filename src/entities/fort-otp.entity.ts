import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { FortUser } from './fort-user.entity';

export enum OtpPurpose {
  EMAIL_VERIFICATION = 'email_verification',
  PASSWORD_CHANGE = 'password_change',
}

@Entity('fort_otps')
export class FortOtp {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  userId!: string;

  @Column()
  otpHash!: string;

  @Column({ type: 'varchar', length: 30 })
  purpose!: OtpPurpose;

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
