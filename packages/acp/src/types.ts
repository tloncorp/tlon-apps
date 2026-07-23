export type AcpMessage = {
  sequence: number;
  sent: string;
  payload: string;
};

export type AcpUpdate = { messages: AcpMessage[] };

export type AcpUpdateHandler = (update: AcpUpdate) => void;

export interface AcpTransport {
  open(): Promise<void>;
  send(payload: string): Promise<void>;
  ack(through: number): Promise<void>;
  subscribe(
    handler: AcpUpdateHandler,
    onError?: (error: unknown) => void
  ): Promise<() => void | Promise<void>>;
  disconnect(): Promise<void>;
}
