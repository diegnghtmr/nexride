import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DEACTIVATE' | 'DELETE';
// DB CHECK constraint (migration 17000000010001) still permits 'ACTIVATE'; intentionally not migrated — see docs/rubric-checklist.md F5 v9-deferred.

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
