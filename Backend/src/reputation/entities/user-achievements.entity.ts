import { User } from 'src/auth/entities/user.entity';
import { Achievement } from './achievement.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';

@Entity()
export class UserAchievement {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User)
  user: User;

  @ManyToOne(() => Achievement)
  achievement: Achievement;

  @CreateDateColumn()
  unlockedAt: Date;
}
