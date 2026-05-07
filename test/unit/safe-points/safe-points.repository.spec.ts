/**
 * Unit tests for SafePointsRepository
 *
 * Strict TDD: written before implementation (RED phase), then made GREEN.
 * SQL query runner is fully stubbed — no database I/O.
 *
 * T-F4-01 (RED → GREEN): repo.update() must include `reason` in SET clauses
 * when input.reason is provided.
 */

import { SafePointsRepository } from '../../../src/safe-points/infrastructure/safe-points.repository';
import { DataSource } from 'typeorm';

function makeDataSource(queryResult: unknown[] = []) {
  return {
    query: jest.fn().mockResolvedValue(queryResult),
  } as unknown as DataSource;
}

const baseUpdateResult = [
  {
    id: 'sp-uuid-001',
    name: 'Parque Norte',
    zone_id: 'zone-001',
    reason: 'updated security justification',
    safety_score: '0.8',
    status: 'active',
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-02'),
    lat: '4.65',
    lng: '-74.05',
  },
];

describe('SafePointsRepository', () => {
  describe('update()', () => {
    it('T-F4-01: reason is included in SET clauses when input.reason is provided', async () => {
      const dataSource = makeDataSource(baseUpdateResult);
      const repo = new SafePointsRepository(dataSource);

      await repo.update('sp-uuid-001', {
        reason: 'updated security justification',
        updatedBy: 'admin',
        auditReason: 'corrected typo',
      });

      // The SQL UPDATE must have been called
      expect(dataSource.query).toHaveBeenCalledTimes(1);

      const [sql, params] = (dataSource.query as jest.Mock).mock.calls[0] as [string, unknown[]];

      // SQL must contain a reason = $N set clause
      expect(sql).toMatch(/reason\s*=\s*\$\d+/);

      // params must contain the new catalog reason value
      expect(params).toContain('updated security justification');
    });

    it('T-F4-02: reason is NOT included in SET clauses when input.reason is undefined', async () => {
      const dataSource = makeDataSource(baseUpdateResult);
      const repo = new SafePointsRepository(dataSource);

      await repo.update('sp-uuid-001', {
        updatedBy: 'admin',
        auditReason: 'minor correction',
      });

      const [sql] = (dataSource.query as jest.Mock).mock.calls[0] as [string, unknown[]];

      // SQL must NOT contain a reason = $N set clause
      expect(sql).not.toMatch(/reason\s*=\s*\$\d+/);
    });

    it('T-F4-03: returns null when no rows come back from DB', async () => {
      const dataSource = makeDataSource([]);
      const repo = new SafePointsRepository(dataSource);

      const result = await repo.update('nonexistent', {
        updatedBy: 'admin',
        auditReason: 'no-op',
      });

      expect(result).toBeNull();
    });
  });
});
