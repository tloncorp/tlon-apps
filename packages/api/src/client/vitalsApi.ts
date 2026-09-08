import { createDevLogger } from '../lib/logger';
import { AnalyticsEvent } from '../types/analytics';
import * as ub from '../urbit';
import { poke, scry, subscribe, unsubscribe } from './urbit';

const logger = createDevLogger('vitalsApi', false);

// Counted, not silently dropped. trackEvent keeps this in PostHog; trackError
// would report as `app_error`, which the composite logger forwards to Sentry —
// the spray these catches exist to prevent.
// No contactId in the payload — ship names should not go into analytics.
function reportBackgroundFailure(context: string, e: unknown) {
  logger.trackEvent(AnalyticsEvent.BackgroundRequestFailed, {
    context,
    errorMessage: e instanceof Error ? e.message : String(e),
  });
}

export const getLastConnectionStatus = async (contactId: string) => {
  const result = await scry<ub.ConnectionUpdate>({
    app: 'vitals',
    path: `/ship/${contactId}`,
  });
  return toConnectionStatus(result);
};

export const checkConnectionStatus = async (
  contactId: string,
  callback: (data: ConnectionStatus) => boolean
) => {
  let unsubscribed = false;
  const subscription = await subscribe<ub.ConnectionUpdate>(
    {
      app: 'vitals',
      path: `/status/${contactId}`,
    },
    (e, id) => {
      if (unsubscribed) {
        return;
      }

      const shouldUnsubscribe = callback(toConnectionStatus(e));

      if (shouldUnsubscribe && id) {
        unsubscribed = true;
        // Fire-and-forget from a void callback. `unsubscribe` rejects on a
        // failed channel PUT, so catch it here or it escapes unhandled.
        unsubscribe(id).catch((e) => {
          reportBackgroundFailure('vitals unsubscribe', e);
        });
      }
    }
  );

  // Fire-and-forget: the subscription above delivers the result, so the poke
  // is only a nudge. Catch so a failed poke doesn't surface as an unhandled
  // rejection.
  poke({
    app: 'vitals',
    mark: 'run-check',
    json: contactId,
  }).catch((e) => {
    reportBackgroundFailure('vitals poke', e);
  });

  return subscription;
};

export type ConnectionState =
  | 'yes'
  | 'crash'
  | 'no-data'
  | 'no-dns'
  | 'no-our-planet'
  | 'no-our-galaxy'
  | 'no-sponsor-hit'
  | 'no-sponsor-miss'
  | 'no-their-galaxy'
  | 'setting-up'
  | 'trying-dns'
  | 'trying-local'
  | 'trying-target'
  | 'trying-sponsor';

export type ConnectionStatus = {
  status: ConnectionState;
  complete: boolean;
  timestamp?: number;
};

export const toConnectionStatus = (
  data: ub.ConnectionUpdate
): ConnectionStatus => {
  if ('complete' in data.status) {
    return {
      complete: true,
      status: data.status.complete,
      timestamp: data.timestamp,
    };
  } else {
    return { complete: false, status: data.status.pending };
  }
};
