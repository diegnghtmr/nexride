import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * TypeORM entity for the `safe_points` table.
 *
 * The `location` column is a PostGIS geography(Point,4326). TypeORM does not
 * have a first-class geography type, so we use a raw transformer to store/read
 * the WKT representation and convert it in the repository layer using ST_AsText
 * / ST_GeographyFromText.
 *
 * All geo queries (ST_DWithin) are done via raw SQL in the repository; this
 * entity is used only for INSERT/UPDATE/SELECT by id.
 */
@Entity('safe_points')
export class SafePointEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ name: 'zone_id', type: 'varchar', length: 60 })
  zoneId!: string;

  @Column({ type: 'varchar', length: 255 })
  reason!: string;

  /**
   * Stored as a text placeholder for the TypeORM entity; actual geographic
   * value is managed via raw queries in the repository.
   * TypeORM will include this in autoLoadEntities but inserts/selects for
   * location are handled raw.
   */
  @Column({
    type: 'text',
    select: false, // excluded from standard SELECT to avoid WKT clutter
    nullable: true,
  })
  locationRaw?: string;

  @Column({
    name: 'safety_score',
    type: 'numeric',
    precision: 4,
    scale: 3,
    transformer: {
      to: (v: number) => v,
      from: (v: string) => parseFloat(v),
    },
  })
  safetyScore!: number;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'active',
  })
  status!: 'active' | 'inactive';

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'created_by', type: 'text', nullable: true })
  createdBy?: string;

  @Column({ name: 'updated_by', type: 'text', nullable: true })
  updatedBy?: string;
}
