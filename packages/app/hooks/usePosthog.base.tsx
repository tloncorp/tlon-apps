export interface PosthogClient {
  getIsOptedOut: () => boolean;
  optIn: () => void;
  optOut: () => void;
  identify: (userId: string, properties: Record<string, any>) => void;
  capture: (eventName: string, properties?: Record<string, any>) => void;
  flush: () => Promise<void>;
  reset: () => void;
  distinctId: () => string | undefined;
}
