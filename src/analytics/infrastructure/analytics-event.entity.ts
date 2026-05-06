import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('analytics_events')
export class AnalyticsEventEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'event_name', type: 'text' })
  eventName!: string;

  @Column({ name: 'request_id', type: 'uuid', nullable: true })
  requestId?: string | null;

  @Column({ name: 'trip_id', type: 'uuid', nullable: true })
  tripId?: string | null;

  @Column({ name: 'user_id', type: 'text', nullable: true })
  userId?: string | null;

  @Column({ name: 'metadata', type: 'jsonb' })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt!: Date;
}
