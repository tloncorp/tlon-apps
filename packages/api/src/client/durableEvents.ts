export interface DurableEvents {
  onopen: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  close(): void;
}

export class DurableConnection {
  private socket?: WebSocket;
  private retry?: ReturnType<typeof setTimeout>;
  private readonly listeners = new Map<DurableEvents, string>();

  constructor(
    private readonly url: () => string,
    private readonly token: () => string
  ) {}

  listen(room: string): DurableEvents {
    const stream: DurableEvents = {
      onopen: null,
      onmessage: null,
      onerror: null,
      close: () => {
        this.listeners.delete(stream);
        if (!this.listeners.size) {
          clearTimeout(this.retry);
          const socket = this.socket;
          this.socket = undefined;
          socket?.close();
        }
      },
    };
    this.listeners.set(stream, room);
    if (this.socket?.readyState === WebSocket.OPEN)
      queueMicrotask(() => {
        if (this.listeners.has(stream)) stream.onopen?.(new Event('open'));
      });
    else if (!this.socket) this.connect();
    return stream;
  }

  private connect() {
    clearTimeout(this.retry);
    if (!this.listeners.size || this.socket) return;
    const socket = new WebSocket(this.url());
    this.socket = socket;
    socket.onopen = () => {
      socket.send(JSON.stringify({ type: 'auth', token: this.token() }));
      for (const stream of [...this.listeners.keys()])
        stream.onopen?.(new Event('open'));
    };
    socket.onmessage = (event) => {
      const data = JSON.parse(String(event.data)) as { room: string };
      for (const [stream, room] of [...this.listeners])
        if (room === data.room || room === '*')
          stream.onmessage?.(new MessageEvent('message', { data: event.data }));
    };
    socket.onerror = () => socket.close();
    socket.onclose = () => {
      if (this.socket !== socket) return;
      this.socket = undefined;
      for (const stream of [...this.listeners.keys()])
        stream.onerror?.(new Event('error'));
      if (this.listeners.size)
        this.retry = setTimeout(() => this.connect(), 2000);
    };
  }
}
