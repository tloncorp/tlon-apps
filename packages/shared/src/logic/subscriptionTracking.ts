export interface PreviewCheck {
  inProgress: boolean;
  attempted: number;
}

const DEFAULT_WAIT = 10 * 60 * 1000;

export function getPreviewTracker(wait = DEFAULT_WAIT) {
  const tracked: Record<string, PreviewCheck> = {};

  const getPreviewTracking = (k: string) =>
    tracked[k] || {
      inProgress: false,
      attempted: 0,
    };

  const isPastWaiting = (attempted: number) => Date.now() - attempted >= wait;

  return {
    tracked,
    shouldLoad: (k: string) => {
      const { attempted, inProgress } = getPreviewTracking(k);
      return isPastWaiting(attempted) && !inProgress;
    },
    newAttempt: (k: string) => {
      tracked[k] = {
        inProgress: true,
        attempted: Date.now(),
      };
    },
    finished: (k: string) => {
      tracked[k].inProgress = false;
    },
  };
}
