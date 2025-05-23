export interface TelemetryClient {
  getIsOptedOut: () => boolean;
  optIn: () => void;
  optOut: () => void;
  identify: (userId: string, properties?: Record<string, any>) => void;
  capture: (eventName: string, properties?: Record<string, any>) => void;
  flush: () => Promise<void>;

  setDisabled: (disabled: boolean) => void;
  captureMandatoryEvent: (event: {
    eventId: string;
    properties?: Record<string, any>;
  }) => void;
  captureAppActive: (platform?: 'web' | 'mobile' | 'electron') => void;
}
