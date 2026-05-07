/**
 * Integration test global setup — runs BEFORE any test module is created.
 *
 * Disables the ThrottlerGuard for all integration tests via env flag.
 * The ConfigurableThrottlerGuard in AppModule checks this flag at request time
 * and returns true (no-op) when THROTTLER_DISABLED=1, preventing 429 errors
 * in test loops (REQ-FIX-V8-08 / F10).
 *
 * IMPORTANT: This file is loaded via jest.integration.config.cjs → setupFiles.
 * It runs in the test runner process before any describe/it blocks execute,
 * so the env var is set before AppModule is bootstrapped.
 */

// Disable throttler for all integration tests
process.env['THROTTLER_DISABLED'] = '1';
