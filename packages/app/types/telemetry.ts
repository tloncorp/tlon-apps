export interface TelemetryClient {
  optedOut: boolean;
  optIn: () => void;
  optOut: () => void;
  identify: (userId: string) => void;
  capture: (eventName: string, properties?: Record<string, any>) => void;
  flush: () => Promise<void>;
  reset: () => void;
}
