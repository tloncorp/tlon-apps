export interface DurablePage {
  cursor: number;
  more: boolean;
}

type EventStream = Pick<
  EventSource,
  'onopen' | 'onmessage' | 'onerror' | 'close'
>;

export class DurableRoomSync<Page extends DurablePage> {
  private stream?: EventStream;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private refreshTimer?: ReturnType<typeof setTimeout>;
  private running?: Promise<void>;
  private stopped = false;
  private again = false;
  private cursor = 0;

  constructor(
    private readonly io: {
      connect(): EventStream;
      read(after: number): Promise<Page>;
      apply(page: Page): Promise<void>;
      status(value: 'active' | 'reconnecting'): void;
      error(value: Error | null): void;
    }
  ) {}

  start() {
    this.connect();
    return this.catchUp();
  }

  stop() {
    this.stopped = true;
    this.stream?.close();
    clearTimeout(this.reconnectTimer);
    clearTimeout(this.refreshTimer);
  }

  private connect() {
    if (this.stopped) return;
    const stream = this.io.connect();
    this.stream = stream;
    stream.onmessage = () => this.refresh();
    stream.onopen = () => {
      this.io.status('active');
      this.refresh();
    };
    stream.onerror = () => {
      stream.close();
      if (this.stopped) return;
      this.io.status('reconnecting');
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout(() => this.connect(), 2000);
    };
  }

  private refresh() {
    void this.catchUp()
      .then(() => this.io.error(null))
      .catch((error) => {
        if (this.stopped) return;
        this.io.error(error);
        clearTimeout(this.refreshTimer);
        this.refreshTimer = setTimeout(() => this.refresh(), 2000);
      });
  }

  private catchUp(): Promise<void> {
    this.again = true;
    if (this.running) return this.running;
    this.running = this.drain().finally(() => {
      this.running = undefined;
    });
    return this.running;
  }

  private async drain() {
    while (this.again && !this.stopped) {
      this.again = false;
      let more = true;
      while (more && !this.stopped) {
        const page = await this.io.read(this.cursor);
        if (this.stopped) return;
        await this.io.apply(page);
        this.cursor = page.cursor;
        more = page.more;
      }
    }
  }
}
