type AnyEventMap = {
  [key: string | symbol | number]: (...args: any[]) => void;
};

export type EventMapForEmitter<Emitter extends EventEmitter> =
  Emitter extends EventEmitter<infer M> ? M : never;

export class EventEmitter<EventMap extends AnyEventMap = AnyEventMap> {
  private listeners: Partial<{
    [E in keyof EventMap]: Array<EventMap[E]>;
  }> = {};

  on<E extends keyof EventMap>(event: E, callback: EventMap[E]) {
    if (!(event in this.listeners)) {
      this.listeners[event] = [];
    }

    this.listeners[event]!.push(callback);

    return this;
  }

  off<E extends keyof EventMap>(event: E, callback: EventMap[E]) {
    if (!(event in this.listeners)) {
      return;
    }
    const index = this.listeners[event]!.findIndex((cb) => cb === callback);
    if (index !== -1) {
      this.listeners[event]!.splice(index, 1);
    }
    return this;
  }

  emit<E extends keyof EventMap>(event: E, ...data: Parameters<EventMap[E]>) {
    if (!(event in this.listeners)) {
      return;
    }

    for (let i = 0; i < this.listeners[event]!.length; i++) {
      const callback = this.listeners[event]![i];
      callback.apply(this, data);
    }
  }
}
