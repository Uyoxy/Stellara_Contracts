import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';
import { User } from '../../../auth/entities/user.entity';

export interface RiskFactor {
  name: string;
  weight: number;
  value: number;
  explanation: string;
}

export enum AlertSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

@Entity('fraud_activities')
export class FraudActivity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { lazy: true })
  user: User;

  @Column({ name: 'activity_type' })
  activityType: string;

  @Column({ name: 'amount', type: 'decimal' })
  amount: number;

  @Column({ name: 'timestamp' })
  timestamp: Date;

  @Column({ name: 'ip_address' })
  ipAddress: string;

  @Column({ name: 'device_id' })
  deviceId: string;

  @Column({ name: 'location', nullable: true })
  location?: string;

  @Column({ name: 'risk_score', type: 'decimal' })
  riskScore: number;

  @Column({ name: 'confidence', type: 'decimal' })
  confidence: number;

  @Column({ name: 'risk_factors', type: 'json' })
  riskFactors: RiskFactor[];

  @Column({ name: 'alert_severity' })
  alertSeverity: AlertSeverity;

  @Column({ name: 'mitigation_actions', type: 'json' })
  mitigationActions: string[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
