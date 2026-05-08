import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

// Históricamente 'ACTIVATE' se removió de la TS union en v0.1.10-mvp como deferral asimétrico;
// restaurado en v0.1.12-mvp (rubric residuals v11, F5) ahora que existe SafePointsService.activate.
// La DB CHECK (migration 17000000010001) siempre lo permitió → sin migración de schema.
export type AuditAction = 'CREATE' | 'UPDATE' | 'ACTIVATE' | 'DEACTIVATE' | 'DELETE';

/**
 * TypeORM entity for the `safe_point_audit` table.
 * Records every mutating operation on a SafePoint for audit/compliance.
 */
@Entity('safe_point_audit')
export class SafePointAuditEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'safe_point_id', type: 'uuid', nullable: true })
  safePointId?: string;

  @Column({ type: 'varchar', length: 20 })
  action!: AuditAction;

  @Column({ type: 'varchar', length: 255 })
  reason!: string;

  @Column({ name: 'changed_by', type: 'text' })
  changedBy!: string;

  @CreateDateColumn({ name: 'changed_at', type: 'timestamptz' })
  changedAt!: Date;

  @Column({ type: 'jsonb', nullable: true })
  snapshot?: Record<string, unknown>;
}
