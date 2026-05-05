import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('trips')
export class TripEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'request_id', type: 'uuid', unique: true })
  requestId!: string;

  @Column({ name: 'rider_id', type: 'text' })
  riderId!: string;

  @Column({ name: 'vehicle_id', type: 'text' })
  vehicleId!: string;

  @Column({ name: 'pickup_type', type: 'text' })
  pickupType!: 'original' | 'suggested';

  @Column({ name: 'suggested_point_id', type: 'uuid', nullable: true })
  suggestedPointId?: string | null;

  @Column({ name: 'pickup_lat', type: 'double precision' })
  pickupLat!: number;

  @Column({ name: 'pickup_lng', type: 'double precision' })
  pickupLng!: number;

  @Column({ name: 'destination_lat', type: 'double precision' })
  destinationLat!: number;

  @Column({ name: 'destination_lng', type: 'double precision' })
  destinationLng!: number;

  @Column({ name: 'status', type: 'text', default: 'assigned' })
  status!: 'requested' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'assigned_at', type: 'timestamptz', default: () => 'now()' })
  assignedAt!: Date;
}
