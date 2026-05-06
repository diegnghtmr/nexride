/**
 * Shared helper for unit tests that need a PinoLogger stub.
 *
 * Returns a jest-mocked object whose shape matches the PinoLogger interface
 * from nestjs-pino. Use this in factories / constructors when migrating
 * use cases from NestJS built-in Logger to PinoLogger (REQ-OBS-6, ADR-6).
 *
 * Usage:
 *   import { createMockPinoLogger } from '../../../helpers/mock-pino-logger';
 *   const logger = createMockPinoLogger();
 *   const useCase = new MyUseCase(...deps, logger as unknown as PinoLogger);
 */
export function createMockPinoLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
    fatal: jest.fn(),
    setContext: jest.fn(),
  };
}

export type MockPinoLogger = ReturnType<typeof createMockPinoLogger>;
