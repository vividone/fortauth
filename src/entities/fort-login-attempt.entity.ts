import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('fort_login_attempts')
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
