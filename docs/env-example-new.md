# .env.example update — F4 v0.1.10-mvp

This file documents the corrected `.env.example` content for F4 (v0.1.10-mvp).

**Apply after merge:**
```bash
# Replace the contents of .env.example with the block below:
```

## Corrected `.env.example` content

```dotenv
# =============================================================================
# .env.example — NexRide MVP
# All values match code defaults in src/common/config/dispatch.config.ts
# and src/app.module.ts. See docs/rubric-checklist.md F4 (v0.1.10-mvp).
# =============================================================================

# ─── Runtime ─────────────────────────────────────────────
NODE_ENV=development
PORT=3000
LOG_LEVEL=info

# ─── PostgreSQL + PostGIS ────────────────────────────────
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=nexride
DB_PASSWORD=nexride_dev
DB_DATABASE=nexride
DB_SYNCHRONIZE=false
DB_LOGGING=false

# ─── Redis ───────────────────────────────────────────────
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# ─── Dispatch thresholds (DD-02 §9) ──────────────────────
# *_PCT keys are decimal ratios (0–1). Battery thresholds use 0–100 to match telemetry.
DISPATCH_CANDIDATE_RADIUS_KM=5
DISPATCH_SAFE_POINT_RADIUS_M=120
DISPATCH_SUGGESTION_THRESHOLD_PCT=0.15            # 0-1 decimal
DISPATCH_ORIGINAL_SAFETY_BASELINE=0.30            # 0-1 decimal
DISPATCH_W_PROXIMITY=0.30                         # weights sum to 1.0
DISPATCH_W_ENERGY=0.25
DISPATCH_W_SAFETY=0.25
DISPATCH_W_CONTINUITY=0.20
DISPATCH_SCORING_CONTINUITY_BATTERY_WEIGHT=0.7    # continuity sub-weights sum to 1.0
DISPATCH_SCORING_CONTINUITY_ZONE_WEIGHT=0.3
DISPATCH_PIPELINE_TIMEOUT_MS=1200
DISPATCH_FALLBACK_MIN_BATTERY=20                  # 0-100 integer (battery %)
DISPATCH_MAX_ETA_SECONDS=600

# ─── Fleet ───────────────────────────────────────────────
FLEET_MINIMUM_RESERVE_PCT=0.15                    # 0-1 decimal
FLEET_TELEMETRY_STALENESS_SEC=60

# ─── Distance provider ───────────────────────────────────
DISTANCE_CACHE_TTL_SEC=60
DISTANCE_PROVIDER_TIMEOUT_MS=800
DISTANCE_INJECT_TIMEOUT=false

# ─── Rate limiting (NFR-17) ──────────────────────────────
THROTTLER_DISABLED=                               # set =1 to bypass (integration tests / perf-smoke)
THROTTLER_TEST_LIMIT=                             # integer override for IP throttler in tests
THROTTLE_USER_LIMIT=                              # production override for per-user limit (default 100)
THROTTLE_IP_LIMIT=                                # production override for per-IP limit (default 1000)

# ─── Test context (NODE_ENV != production) ───────────────
TEST_CONTEXT_GUARD_ENABLED=true
```

## Keys changed (from old .env.example)

| Old key | New key | Reason |
|---------|---------|--------|
| `DISPATCH_WEIGHT_PROXIMITY` | `DISPATCH_W_PROXIMITY=0.30` | Renamed to match dispatch.config.ts |
| `DISPATCH_WEIGHT_ENERGY` | `DISPATCH_W_ENERGY=0.25` | Renamed to match dispatch.config.ts |
| `DISPATCH_WEIGHT_SAFETY` | `DISPATCH_W_SAFETY=0.25` | Renamed to match dispatch.config.ts |
| `DISPATCH_WEIGHT_CONTINUITY` | `DISPATCH_W_CONTINUITY=0.20` | Renamed to match dispatch.config.ts |
| `DISPATCH_FALLBACK_MIN_BATTERY_PCT` | `DISPATCH_FALLBACK_MIN_BATTERY=20` | Renamed; scale changed to 0-100 integer to match telemetry |
| `DISTANCE_PROVIDER_INJECT_TIMEOUT` | `DISTANCE_INJECT_TIMEOUT=false` | Renamed to match code read key |
| `FLEET_MINIMUM_RESERVE_PCT=15` | `FLEET_MINIMUM_RESERVE_PCT=0.15` | Value corrected from integer to decimal ratio |

## New keys added

- `DISPATCH_SCORING_CONTINUITY_BATTERY_WEIGHT=0.7`
- `DISPATCH_SCORING_CONTINUITY_ZONE_WEIGHT=0.3`
- `THROTTLER_DISABLED=`
- `THROTTLER_TEST_LIMIT=`
- `THROTTLE_USER_LIMIT=`
- `THROTTLE_IP_LIMIT=`
