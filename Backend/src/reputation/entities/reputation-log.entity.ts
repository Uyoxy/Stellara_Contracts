import { User } from 'src/auth/entities/user.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';
import { ReputationAction } from '../types/reputation.types';
@Entity()
export class ReputationLog {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User)
  user: User;

  @Column({ type: 'enum', enum: ReputationAction })
  action: ReputationAction;

  @Column()
  reputationChange: number;

  @Column()
  xpChange: number;

  @CreateDateColumn()
  createdAt: Date;
}
