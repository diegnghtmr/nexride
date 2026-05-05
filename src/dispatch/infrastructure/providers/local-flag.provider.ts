import { IFlagProvider } from '../../../common/interfaces/IFlagProvider';
import { DispatchConfig } from '../../../common/config/dispatch.config';

/**
 * LocalFlagProvider — implements IFlagProvider by reading from the static
 * DispatchConfig POJO (env-derived). Synchronous, no I/O.
 *
 * ADR-002: Drop-in replacement for Unleash when flag infra is needed post-MVP.
 */
export class LocalFlagProvider implements IFlagProvider {
  constructor(private readonly cfg: DispatchConfig) {}

  isEnabled(flag: string, _ctx?: object): boolean {
    return this.getBoolean(flag, false);
  }

  getNumber(key: string, fallback: number): number {
    const value = this.resolveKey(key);
    if (value === undefined) return fallback;
    const n = Number(value);
    return isNaN(n) ? fallback : n;
  }

  getBoolean(key: string, fallback: boolean): boolean {
    const value = this.resolveKey(key);
    if (value === undefined) return fallback;
    if (typeof value === 'boolean') return value;
    if (value === 'true' || value === '1') return true;
    if (value === 'false' || value === '0') return false;
    return fallback;
  }

  /**
   * Simple dot-notation key resolver over the flattened config object.
   * Supports: 'maxEtaSeconds', 'weights.proximity', 'fleet.minimumReservePct', etc.
   */
  private resolveKey(key: string): unknown {
    const parts = key.split('.');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let obj: any = this.cfg;
    for (const part of parts) {
      if (obj === null || obj === undefined || typeof obj !== 'object') return undefined;
      obj = obj[part];
    }
    return obj;
  }
}
