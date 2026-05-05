import { LocalFlagProvider } from '../../../../src/dispatch/infrastructure/providers/local-flag.provider';
import { loadDispatchConfig } from '../../../../src/common/config/dispatch.config';

const cfg = loadDispatchConfig({});

describe('LocalFlagProvider', () => {
  it('returns a number value for a top-level config key', () => {
    const provider = new LocalFlagProvider(cfg);
    expect(provider.getNumber('maxEtaSeconds', 0)).toBe(600);
  });

  it('returns a number value for a nested config key via dot notation', () => {
    const provider = new LocalFlagProvider(cfg);
    expect(provider.getNumber('weights.proximity', 0)).toBeCloseTo(0.3, 6);
  });

  it('returns the fallback number when key is not found', () => {
    const provider = new LocalFlagProvider(cfg);
    expect(provider.getNumber('nonexistent.key', 42)).toBe(42);
  });

  it('returns a boolean value for an existing key', () => {
    const provider = new LocalFlagProvider(cfg);
    // distance.injectTimeout defaults to false
    expect(provider.getBoolean('distance.injectTimeout', true)).toBe(false);
  });

  it('returns the fallback boolean when key is not found', () => {
    const provider = new LocalFlagProvider(cfg);
    expect(provider.getBoolean('nonexistent.flag', true)).toBe(true);
  });

  it('delegates isEnabled to getBoolean', () => {
    const provider = new LocalFlagProvider(cfg);
    // distance.injectTimeout = false → isEnabled returns false
    expect(provider.isEnabled('distance.injectTimeout')).toBe(false);
  });

  it('returns fallback for unknown nested path', () => {
    const provider = new LocalFlagProvider(cfg);
    expect(provider.getNumber('fleet.nonexistent', 99)).toBe(99);
  });
});
