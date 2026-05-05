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

  @Column({ name: 'rider_id', type: 'text', nullable: true })
  riderId?: string | null;

  @Column({ name: 'payload_json', type: 'jsonb' })
  payloadJson!: Record<string, unknown>;

  @CreateDateColumn({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt!: Date;
}
