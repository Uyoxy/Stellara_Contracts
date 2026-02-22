import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';
import {
  AchievementCategory,
  AchievementTier,
} from '../types/reputation.types';
@Entity()
export class Achievement {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column()
  description: string;

  @Column({ type: 'enum', enum: AchievementCategory })
  category: AchievementCategory;

  @Column({ type: 'enum', enum: AchievementTier })
  tier: AchievementTier;

  @Column()
  conditionKey: string;
  // Example: "posts_created", "courses_completed"

  @Column()
  threshold: number;
}
