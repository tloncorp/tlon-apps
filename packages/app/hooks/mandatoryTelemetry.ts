export type MandatoryPosthogClient = {
  optIn: () => void;
  optOut: () => void;
  capture: (eventName: string, properties?: Record<string, unknown>) => void;
  flush: () => Promise<void>;
};

let mandatoryCaptureQueue: Promise<void> = Promise.resolve();

export function captureMandatoryEventWithClient({
  posthog,
  getIsOptedOut,
  eventId,
  properties,
}: {
  posthog: MandatoryPosthogClient;
  getIsOptedOut: () => boolean;
  eventId: string;
  properties?: Record<string, unknown>;
}): Promise<void> {
  const capture = async () => {
    const wasOptedOut = getIsOptedOut();
    if (!wasOptedOut) {
      posthog.capture(eventId, properties);
      return;
    }

    posthog.optIn();
    try {
      posthog.capture(eventId, properties);
      await posthog.flush();
    } finally {
      posthog.optOut();
    }
  };

  const result = mandatoryCaptureQueue.then(capture);
  mandatoryCaptureQueue = result.catch(() => undefined);
  return result;
}
