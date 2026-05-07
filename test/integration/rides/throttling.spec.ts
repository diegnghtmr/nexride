/**
 * Rate Limiting Integration Test (T-030 · RED · F10)
 *
 * Strict TDD: This file is the RED commit — written BEFORE @nestjs/throttler is installed
 * and before ThrottlerModule is registered in AppModule.
 *
 * Verifies that the global ThrottlerGuard enforces a limit of 100 requests per 60s per IP.
 * The 101st request within the window MUST return HTTP 429.
 *
 * IMPORTANT: THROTTLER_DISABLED must NOT be set for this test file.
 * All other integration tests set THROTTLER_DISABLED=1 in beforeAll.
 * This test explicitly clears that env var so the throttler is active.
 *
 * Uses a lightweight NestJS app with a minimal module — no Docker required
 * (throttler operates in-memory; no DB or Redis needed for this test).
 */

import { INestApplication, Controller, Get, Module, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

/**
 * Minimal controller for throttling test — single GET /throttle-test endpoint.
 * Avoids full AppModule + containers; throttler is the only concern.
 */
@Controller()
class ThrottleTestController {
  @Get('throttle-test')
  ping(): { ok: boolean } {
    return { ok: true };
  }
}

describe('Global ThrottlerGuard (integration · T-030)', () => {
  let app: INestApplication;
  let savedThrottlerDisabled: string | undefined;

  beforeAll(async () => {
    // Explicitly disable throttler bypass for this test suite
    savedThrottlerDisabled = process.env['THROTTLER_DISABLED'];
    delete process.env['THROTTLER_DISABLED'];

    // Dynamically import AppModule after clearing env var so AppModule sees THROTTLER_DISABLED=undefined
    // We use a dedicated minimal module to keep the test fast (no DB/Redis containers)
    // The ThrottlerModule + guard registration is what we're testing — we import it directly.
    // After GREEN: ThrottlerModule is registered in AppModule with ttl:60_000, limit:100.
    // For this RED test, we reproduce the expected AppModule registration in isolation.

    const { ThrottlerModule, ThrottlerGuard } = await import('@nestjs/throttler').catch(() => {
      throw new Error('RED: @nestjs/throttler is not installed yet. Install it to turn this test GREEN.');
    });

    const { APP_GUARD } = await import('@nestjs/core');

    @Module({
      imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }])],
      controllers: [ThrottleTestController],
      providers: [
        {
          provide: APP_GUARD,
          useClass: ThrottlerGuard,
        },
      ],
    })
    class ThrottleTestModule {}

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [ThrottleTestModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  }, 30_000);

  afterAll(async () => {
    await app?.close();
    // Restore env var
    if (savedThrottlerDisabled !== undefined) {
      process.env['THROTTLER_DISABLED'] = savedThrottlerDisabled;
    } else {
      delete process.env['THROTTLER_DISABLED'];
    }
  });

  it('first 100 requests succeed (2xx), 101st returns 429 TooManyRequests', async () => {
    const server = app.getHttpServer();

    // Fire 100 requests — all should succeed
    for (let i = 0; i < 100; i++) {
      await request(server).get('/throttle-test').expect(200);
    }

    // 101st request must be rate-limited
    const response = await request(server).get('/throttle-test').expect(429);

    // ThrottlerException body
    expect(response.body).toMatchObject(
      expect.objectContaining({
        statusCode: 429,
      }),
    );
  }, 60_000);
});
