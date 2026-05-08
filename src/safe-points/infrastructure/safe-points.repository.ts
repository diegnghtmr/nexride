import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
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

  async create(input: CreateSafePointInput, manager?: EntityManager): Promise<SafePoint> {
    const runner = manager ?? this.dataSource;
    const result = await runner.query<
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

  async update(id: string, input: UpdateSafePointInput, manager?: EntityManager): Promise<SafePoint | null> {
    const runner = manager ?? this.dataSource;
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
    if (input.reason !== undefined) {
      setClauses.push(`reason = $${paramIdx++}`);
      params.push(input.reason);
    }

    type UpdateRow = {
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
    };

    // Judgment 20° F7 / S1 closure (ADR-013): the pg driver via TypeORM's
    // runner.query() returns DIFFERENT shapes for UPDATE...RETURNING vs.
    // INSERT/SELECT...RETURNING:
    //   UPDATE...RETURNING → [rowsArray, affectedCount]  (2-tuple)
    //   INSERT/SELECT      → rowsArray                   (flat)
    // The previous code treated the tuple as a flat array, causing rows[0]
    // to be the whole rowsArray instead of the first row, which made every
    // field undefined → NaN → null in the JSON response.
    // Defend against both shapes so a future driver bump cannot regress us.
    const result = (await runner.query(
      `UPDATE safe_points
       SET ${setClauses.join(', ')}
       WHERE id = $1
       RETURNING id, name, zone_id, reason, safety_score, status, created_at, updated_at,
                 ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng`,
      params,
    )) as UpdateRow[] | [UpdateRow[], number];
    const rows: UpdateRow[] = Array.isArray((result as unknown[])[0]) ? (result as [UpdateRow[], number])[0] : (result as UpdateRow[]);

    if (!rows.length) return null;
    const row = rows[0];
    return this.mapRow(row, { lat: parseFloat(row.lat), lng: parseFloat(row.lng) });
  }

  async delete(id: string, manager?: EntityManager): Promise<void> {
    const runner = manager ?? this.dataSource;
    await runner.query(`DELETE FROM safe_points WHERE id = $1`, [id]);
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

  async writeAudit(input: AuditInput, manager?: EntityManager): Promise<void> {
    const runner = manager ?? this.dataSource;
    await runner.query(
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
