import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SafePointEntity } from './safe-point.entity';
import { SafePointAuditEntity, AuditAction } from './safe-point-audit.entity';
import { GeoPoint, SafePoint } from '../../common/interfaces/shared-types';
import { CreateSafePointInput, UpdateSafePointInput } from '../../common/interfaces/ISafePointsService';

export interface AuditInput {
  safePointId: string;
  action: AuditAction;
  reason: string;
  changedBy: string;
  snapshot?: Record<string, unknown>;
}

/**
 * Repository for SafePoints that uses raw SQL for geographic operations.
 *
 * TypeORM's geography type support is limited — all ST_DWithin / ST_GeographyFromText
 * calls are issued as parameterized raw queries through the DataSource.
 */
@Injectable()
export class SafePointsRepository {
  constructor(private readonly dataSource: DataSource) {}

  async create(input: CreateSafePointInput): Promise<SafePoint> {
    const result = await this.dataSource.query<
      Array<{
        id: string;
        name: string;
        zone_id: string;
        reason: string;
        safety_score: string;
        status: string;
        created_at: Date;
        updated_at: Date;
        created_by: string | null;
      }>
    >(
      `INSERT INTO safe_points (name, zone_id, reason, location, safety_score, created_by)
       VALUES ($1, $2, $3, ST_GeographyFromText($4), $5, $6)
       RETURNING id, name, zone_id, reason, safety_score, status, created_at, updated_at, created_by`,
      [input.name, input.zoneId, input.reason ?? '', this.toWKT(input.location), input.safetyScore, input.createdBy],
    );

    return this.mapRow(result[0], input.location);
  }

  async findById(id: string): Promise<SafePoint | null> {
    const rows = await this.dataSource.query<
      Array<{
        id: string;
        name: string;
        zone_id: string;
        reason: string;
        safety_score: string;
        status: string;
        created_at: Date;
        updated_at: Date;
        lat: string;
        lng: string;
      }>
    >(
      `SELECT id, name, zone_id, reason, safety_score, status, created_at, updated_at,
              ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng
       FROM safe_points
       WHERE id = $1`,
      [id],
    );

    if (!rows.length) return null;
    const row = rows[0];
    return this.mapRow(row, { lat: parseFloat(row.lat), lng: parseFloat(row.lng) });
  }

  async update(id: string, input: UpdateSafePointInput): Promise<SafePoint | null> {
    const setClauses: string[] = ['updated_at = now()', 'updated_by = $2'];
    const params: unknown[] = [id, input.updatedBy];
    let paramIdx = 3;

    if (input.name !== undefined) {
      setClauses.push(`name = $${paramIdx++}`);
      params.push(input.name);
    }
    if (input.zoneId !== undefined) {
      setClauses.push(`zone_id = $${paramIdx++}`);
      params.push(input.zoneId);
    }
    if (input.safetyScore !== undefined) {
      setClauses.push(`safety_score = $${paramIdx++}`);
      params.push(input.safetyScore);
    }
    if (input.status !== undefined) {
      setClauses.push(`status = $${paramIdx++}`);
      params.push(input.status);
    }
    if (input.location !== undefined) {
      setClauses.push(`location = ST_GeographyFromText($${paramIdx++})`);
      params.push(this.toWKT(input.location));
    }

    const rows = await this.dataSource.query<
      Array<{
        id: string;
        name: string;
        zone_id: string;
        reason: string;
        safety_score: string;
        status: string;
        created_at: Date;
        updated_at: Date;
        lat: string;
        lng: string;
      }>
    >(
      `UPDATE safe_points
       SET ${setClauses.join(', ')}
       WHERE id = $1
       RETURNING id, name, zone_id, reason, safety_score, status, created_at, updated_at,
                 ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng`,
      params,
    );

    if (!rows.length) return null;
    const row = rows[0];
    return this.mapRow(row, { lat: parseFloat(row.lat), lng: parseFloat(row.lng) });
  }

  async delete(id: string): Promise<void> {
    await this.dataSource.query(`DELETE FROM safe_points WHERE id = $1`, [id]);
  }

  async findWithin(point: GeoPoint, radiusM: number): Promise<SafePoint[]> {
    const rows = await this.dataSource.query<
      Array<{
        id: string;
        name: string;
        zone_id: string;
        reason: string;
        safety_score: string;
        status: string;
        created_at: Date;
        updated_at: Date;
        lat: string;
        lng: string;
      }>
    >(
      `SELECT id, name, zone_id, reason, safety_score, status, created_at, updated_at,
              ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng
       FROM safe_points
       WHERE status = 'active'
         AND ST_DWithin(location, ST_GeographyFromText($1), $2)
       ORDER BY safety_score DESC`,
      [this.toWKT(point), radiusM],
    );

    return rows.map((row) => this.mapRow(row, { lat: parseFloat(row.lat), lng: parseFloat(row.lng) }));
  }

  async writeAudit(input: AuditInput): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO safe_point_audit (safe_point_id, action, reason, changed_by, snapshot)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        input.safePointId,
        input.action,
        input.reason,
        input.changedBy,
        input.snapshot ? JSON.stringify(input.snapshot) : null,
      ],
    );
  }

  private toWKT(point: GeoPoint): string {
    return `POINT(${point.lng} ${point.lat})`;
  }

  private mapRow(
    row: {
      id: string;
      name: string;
      zone_id: string;
      reason: string;
      safety_score: string;
      status: string;
      created_at: Date;
      updated_at: Date;
      created_by?: string | null;
    },
    location: GeoPoint,
  ): SafePoint {
    return {
      id: row.id,
      name: row.name,
      zoneId: row.zone_id,
      reason: row.reason,
      safetyScore: parseFloat(row.safety_score),
      status: row.status as 'active' | 'inactive',
      location,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const SAFE_POINTS_REPOSITORY = Symbol('SafePointsRepository');

// Re-export entity types needed by the module
export { SafePointEntity, SafePointAuditEntity };
