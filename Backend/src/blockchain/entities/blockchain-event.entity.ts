import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('blockchain_events')
export class BlockchainEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  eventId: string; // unique on-chain event ID

  @Column()
  contract: string;

  @Column()
  type: string;

  @Column('jsonb')
  payload: any;

  @Column()
  blockNumber: number;

  @Column()
  timestamp: Date;

  @Column({ default: false })
  processed: boolean;
}
