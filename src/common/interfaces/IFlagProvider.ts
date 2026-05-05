export interface IFlagProvider {
  isEnabled(flag: string, ctx?: object): boolean;
  getNumber(key: string, fallback: number): number;
  getBoolean(key: string, fallback: boolean): boolean;
}

export const FLAG_PROVIDER = Symbol('IFlagProvider');
