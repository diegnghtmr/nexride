/**
 * Validates that createMockPinoLogger returns a correctly shaped stub.
 * This is infrastructure-of-test — GREEN direct per TDD rules (purely structural).
 *
 * REQ-OBS-6, ADR-6
 */
import { createMockPinoLogger } from '../../../helpers/mock-pino-logger';

describe('createMockPinoLogger helper', () => {
  it('returns an object with all required PinoLogger methods as jest.fn()', () => {
    const logger = createMockPinoLogger();

    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.setContext).toBe('function');
  });

  it('info, warn, error are callable and return undefined (jest mock default)', () => {
    const logger = createMockPinoLogger();

    expect(logger.info({ requestId: 'r-1' }, 'test')).toBeUndefined();
    expect(logger.warn({ reason: 'timeout' }, 'fallback')).toBeUndefined();
    expect(logger.error({ err: new Error('x') }, 'fatal')).toBeUndefined();
  });

  it('setContext records the call argument (jest spy verification)', () => {
    const logger = createMockPinoLogger();

    logger.setContext('EvaluateDispatchUseCase');

    expect(logger.setContext).toHaveBeenCalledWith('EvaluateDispatchUseCase');
  });
});
