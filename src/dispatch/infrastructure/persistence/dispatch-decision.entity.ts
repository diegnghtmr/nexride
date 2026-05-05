import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/**
 * TypeORM entity for the `dispatch_decisions` table.
 * This table stores one row per ride request, updated at confirmation time.
 */
@Entity('dispatch_decisions')
export class DispatchDecisionEntity {
  /** request_id serves as the primary key (UUID from the caller). */
  @PrimaryColumn({ name: 'request_id', type: 'uuid' })
  requestId!: string;

  @Column({ name: 'rider_id', type: 'text' })
  riderId!: string;

  /** Original origin latitude */
  @Column({ name: 'original_lat', type: 'double precision' })
  originalLat!: number;

  /** Original origin longitude */
  @Column({ name: 'original_lng', type: 'double precision' })
  originalLng!: number;

  /** Destination latitude — persisted for trip creation at confirm time (nullable for back-compat) */
  @Column({ name: 'destination_lat', type: 'double precision', nullable: true })
  destinationLat?: number | null;

  /** Destination longitude */
  @Column({ name: 'destination_lng', type: 'double precision', nullable: true })
  destinationLng?: number | null;

  /** Suggested safe-point latitude (nullable — only set when suggestion was shown) */
  @Column({ name: 'suggested_lat', type: 'double precision', nullable: true })
  suggestedLat?: number | null;

  /** Suggested safe-point longitude (nullable) */
  @Column({ name: 'suggested_lng', type: 'double precision', nullable: true })
  suggestedLng?: number | null;

  /** FK to safe_points.id — null when no suggestion was generated */
  @Column({ name: 'suggested_point_id', type: 'uuid', nullable: true })
  suggestedPointId?: string | null;

  /** Winner vehicle id */
  @Column({ name: 'vehicle_id', type: 'text' })
  vehicleId!: string;

  /** Full scoring matrix as JSONB */
  @Column({ name: 'scores_json', type: 'jsonb' })
  scoresJson!: Record<string, unknown>;

  /** Reason for fallback activation (null when no fallback) */
  @Column({ name: 'fallback_reason', type: 'text', nullable: true })
  fallbackReason?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  /** Populated after POST /rides/confirm */
  @Column({ name: 'trip_id', type: 'uuid', nullable: true })
  tripId?: string | null;

  /** User's pickup choice at confirmation time */
  @Column({ name: 'user_choice', type: 'text', nullable: true })
  userChoice?: 'original' | 'suggested' | null;

  /** Timestamp of confirmation */
  @Column({ name: 'confirmed_at', type: 'timestamptz', nullable: true })
  confirmedAt?: Date | null;

  /** Pipeline execution duration in ms */
  @Column({ name: 'pipeline_duration_ms', type: 'int', nullable: true })
  pipelineDurationMs?: number | null;

  /** Suggestion status */
  @Column({ name: 'suggestion_status', type: 'text', default: 'not_shown' })
  suggestionStatus!: 'shown' | 'not_shown';
}
