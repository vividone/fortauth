import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('fort_login_attempts')
@Index(['email', 'success', 'createdAt'])
export class FortLoginAttempt {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  email!: string;

  @Column()
  ipAddress!: string;

  @Column()
  success!: boolean;

  @Column({ nullable: true })
  reason?: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
