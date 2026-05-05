import { randomUUID } from 'crypto';

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class RequestId {
  readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  static new(): RequestId {
    return new RequestId(randomUUID());
  }

  static from(str: string): RequestId {
    if (!str || !UUID_V4_REGEX.test(str)) {
      throw new Error(`RequestId: invalid UUID v4 string: "${str}"`);
    }
    return new RequestId(str);
  }
}
