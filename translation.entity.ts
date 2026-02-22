import { Entity, Column, PrimaryGeneratedColumn, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('translations')
@Index(['resourceType', 'resourceId', 'languageCode', 'field'], { unique: true })
export class Translation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  resourceType: string; // e.g., 'course', 'product'

  @Column()
  resourceId: string;

  @Column()
  languageCode: string; // e.g., 'en', 'es', 'fr'

  @Column()
  field: string; // e.g., 'title', 'description'

  @Column('text')
  value: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}