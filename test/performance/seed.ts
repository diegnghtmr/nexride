/**
 * Performance smoke seed — populates Postgres safe_points and Redis fleet
 * with the minimum data required for the k6 smoke (rides-request.k6.js)
 * to receive 201 responses on POST /rides/request for Bogotá origin
 * (lat 4.65, lng -74.05).
 *
 * Run with:
 *   DATABASE_URL=... REDIS_URL=... ts-node test/performance/seed.ts
 *
 * Idempotent: safe to run multiple times; resets safe_points + fleet:* keys.
 */
import 'reflect-metadata';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Client } = require('pg');
import IORedis from 'ioredis';

const ORIGIN_LAT = 4.65;
const ORIGIN_LNG = -74.05;

async function seedPostgres(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    // Migrations should have already created the schema. Just verify and seed.
    await client.query('DELETE FROM safe_points');
    await client.query(
      `INSERT INTO safe_points (id, name, reason, zone_id, safety_score, status, location, created_at, updated_at)
       VALUES
         ('11111111-1111-1111-1111-111111111111', 'Perf SP Near High', 'Iluminación óptima', 'zona-perf', 0.85, 'active',
          ST_GeographyFromText('SRID=4326;POINT(-74.05 4.6509)'), now(), now()),
         ('22222222-2222-2222-2222-222222222222', 'Perf SP Backup',  'Zona vigilada',     'zona-perf', 0.80, 'active',
          ST_GeographyFromText('SRID=4326;POINT(-74.0505 4.6505)'), now(), now())`,
    );
    // eslint-disable-next-line no-console
    console.log('[seed] Postgres safe_points: 2 rows');
  } finally {
    await client.end();
  }
}

async function seedRedis(): Promise<void> {
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
  const redis = new IORedis(url);
  try {
    // Clear any stale fleet data
    const keys = await redis.keys('fleet:*');
    if (keys.length > 0) await redis.del(...keys);

    const nowIso = new Date().toISOString();

    // 4 fresh in_service vehicles within ~1 km of origin
    const vehicles = [
      { id: 'VH-PERF-001', lat: 4.651, lng: -74.051, battery: 85 },
      { id: 'VH-PERF-002', lat: 4.652, lng: -74.052, battery: 72 },
      { id: 'VH-PERF-003', lat: 4.6515, lng: -74.0495, battery: 65 },
      { id: 'VH-PERF-004', lat: 4.6495, lng: -74.0505, battery: 58 },
    ];

    for (const v of vehicles) {
      await (redis.geoadd as (...args: unknown[]) => Promise<unknown>)(
        'fleet:geo', v.lng, v.lat, v.id,
      );
      await redis.hset(`fleet:vehicles:${v.id}`, {
        battery_pct: String(v.battery),
        eligible: '1',
        state: 'in_service',
        snapshot_at: nowIso,
        range_km: '120',
      });
    }
    // eslint-disable-next-line no-console
    console.log(`[seed] Redis fleet: ${vehicles.length} vehicles around (${ORIGIN_LAT},${ORIGIN_LNG})`);
  } finally {
    await redis.quit();
  }
}

async function main(): Promise<void> {
  await seedPostgres();
  await seedRedis();
  // eslint-disable-next-line no-console
  console.log('[seed] OK');
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[seed] FAILED:', err);
  process.exit(1);
});
