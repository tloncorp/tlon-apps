export type AcpPeer = 'client' | 'agent';

export type AcpMessage = {
  sequence: number;
  sent: string;
  payload: string;
};

export type AcpUpdate =
  | {
      connection: string;
      open: boolean;
      reason: string | null;
    }
  | {
      messages: AcpMessage[];
    };

export type AcpUpdateHandler = (update: AcpUpdate) => void;

export interface AcpTransport {
  open(): Promise<void>;
  send(target: AcpPeer, payload: string): Promise<void>;
  ack(target: AcpPeer, through: number): Promise<void>;
  subscribe(
    target: AcpPeer,
    handler: AcpUpdateHandler,
    onError?: (error: unknown) => void
  ): Promise<() => void | Promise<void>>;
  disconnect(): Promise<void>;
}

export function parseAcpUpdate(value: unknown): AcpUpdate {
  if (!isRecord(value)) {
    throw new Error('ACP update must be an object');
  }

  if ('messages' in value) {
    if (!Array.isArray(value.messages)) {
      throw new Error('ACP messages update must contain an array');
    }
    return {
      messages: value.messages.map((message) => {
        if (
          !isRecord(message) ||
          !Number.isSafeInteger(message.sequence) ||
          (message.sequence as number) < 1 ||
          typeof message.sent !== 'string' ||
          typeof message.payload !== 'string'
        ) {
          throw new Error('ACP message has an invalid shape');
        }
        return {
          sequence: message.sequence as number,
          sent: message.sent,
          payload: message.payload,
        };
      }),
    };
  }

  const connection = value.connection;
  if (
    isRecord(connection) &&
    typeof connection.id === 'string' &&
    typeof connection.open === 'boolean' &&
    (connection.reason === null || typeof connection.reason === 'string')
  ) {
    return {
      connection: connection.id,
      open: connection.open,
      reason: connection.reason,
    };
  }

  throw new Error(
    `Unrecognized ACP update envelope (keys: ${Object.keys(value).join(', ')})`
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
