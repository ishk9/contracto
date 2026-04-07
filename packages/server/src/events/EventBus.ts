import type { EventMap } from './EventTypes.js';

type Handler<T> = (payload: T) => void;

export class EventBus {
  private listeners = new Map<string, Set<Handler<unknown>>>();

  on<K extends keyof EventMap>(event: K, handler: Handler<EventMap[K]>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler as Handler<unknown>);
  }

  off<K extends keyof EventMap>(event: K, handler: Handler<EventMap[K]>): void {
    this.listeners.get(event)?.delete(handler as Handler<unknown>);
  }

  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    const handlers = this.listeners.get(event);
    if (!handlers) return;

    for (const handler of handlers) {
      try {
        handler(payload);
      } catch {
        // Observer failure never breaks emitter
      }
    }
  }

  listenerCount<K extends keyof EventMap>(event: K): number {
    return this.listeners.get(event)?.size ?? 0;
  }

  removeAllListeners(): void {
    this.listeners.clear();
  }
}
