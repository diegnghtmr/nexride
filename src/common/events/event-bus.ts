import { EventEmitter } from 'events';
import { DispatchEventName } from './event-names';
import { EventPayloadMap, PayloadOf } from './event-payloads';

/**
 * TypedEventBus wraps Node's EventEmitter to provide type-safe emit/on.
 * In NestJS context, inject EventEmitter2 from @nestjs/event-emitter and
 * delegate to it. For unit tests, standalone mode uses native EventEmitter.
 */
export class TypedEventBus {
  private readonly emitter: EventEmitter;

  constructor(emitter?: EventEmitter) {
    this.emitter = emitter ?? new EventEmitter();
    this.emitter.setMaxListeners(50);
  }

  emitTyped<E extends DispatchEventName>(name: E, payload: PayloadOf<E>): void {
    this.emitter.emit(name, payload);
  }

  onTyped<E extends DispatchEventName>(name: E, handler: (payload: PayloadOf<E>) => void): void {
    this.emitter.on(name, handler as (...args: unknown[]) => void);
  }

  offTyped<E extends DispatchEventName>(name: E, handler: (payload: PayloadOf<E>) => void): void {
    this.emitter.off(name, handler as (...args: unknown[]) => void);
  }
}

/**
 * EventPayloadMap re-exported for consumers that need the full mapping.
 */
export type { EventPayloadMap };
