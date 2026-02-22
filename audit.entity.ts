import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  @Index()
  userId: string;

  @Column()
  @Index()
  action: string; // e.g., 'CREATE_USER', 'LOGIN', 'TRANSFER_FUNDS'

  @Column({ nullable: true })
  resource: string; // e.g., 'User', 'Transaction'

  @Column({ nullable: true })
  resourceId: string;

  @Column('jsonb', { nullable: true })
  details: Record<string, any>;

  @Column({ nullable: true })
  ipAddress: string;

  @Column({ nullable: true })
  userAgent: string;

  @Column({ default: 'SUCCESS' })
  status: 'SUCCESS' | 'FAILURE' | 'WARNING';

  @Column({ default: 'low' })
  severity: 'low' | 'medium' | 'high' | 'critical';

  @CreateDateColumn()
  @Index()
  createdAt: Date;
}