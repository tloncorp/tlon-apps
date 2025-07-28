type AnyEventMap = { [key: string]: (...args: any[]) => void };

export class EventEmitter<
  EventMap extends AnyEventMap = { [key: string]: (...args: any[]) => void },
> {
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
