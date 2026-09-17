import {
  appendToPostBlob,
  getChannelPosts,
  parsePostBlob,
} from '@tloncorp/api';
import type { OpenClawConfig } from 'openclaw/plugin-sdk/core';
import type {
  PluginHookCronChangedEvent,
  PluginHookGatewayCronJob,
} from 'openclaw/plugin-sdk/types';
import { getTlonCronService } from '../../cron-telemetry.js';
import { sharedMap } from '../../shared-state.js';
import type { TlonTelemetryClient } from '../../telemetry.js';
import { listRunnableTlonAccountIds } from '../../types.js';
import { captureTlonApiScope } from '../../urbit/api-client.js';
import { type BotProfile, sendDm } from '../../urbit/send.js';
import { type CampaignConfig } from './model.js';
import { createCampaign } from './runner.js';

const observers = sharedMap<
  string,
  (event: PluginHookCronChangedEvent) => void
>('onboardingCampaign.cronObservers');
export function notifyCampaignCronChanged(event: PluginHookCronChangedEvent) {
  for (const observer of observers.values()) observer(event);
}

export function isUserRecurringTask(job: PluginHookGatewayCronJob): boolean {
  // Campaigns create no cron jobs. One-shot forced onboarding runs are not recurring work.
  return (
    (job.schedule?.kind === 'cron' || job.schedule?.kind === 'every') &&
    job.payload?.kind !== 'heartbeat' &&
    !job.description?.startsWith('tlon-internal:')
  );
}

export function createLiveCampaign(deps: {
  accountId: string;
  owner: string;
  bot: string;
  config: () => OpenClawConfig;
  botProfile: () => BotProfile | undefined;
  busy: () => boolean;
  telemetry?: TlonTelemetryClient | null;
  error: (error: unknown) => void;
  signal?: AbortSignal;
}) {
  const capturedScope = captureTlonApiScope();
  const scope = <T>(fn: () => Promise<T>): Promise<T> => {
    if (!capturedScope)
      return Promise.reject(new Error('Campaign API scope unavailable'));
    return capturedScope(fn);
  };
  const runningJobs = new Set<string>();
  const campaign = createCampaign({
    owner: deps.owner,
    config: () => {
      const cfg = deps.config();
      const campaignConfig =
        (
          cfg.channels?.tlon as
            | { onboardingCampaign?: CampaignConfig }
            | undefined
        )?.onboardingCampaign ?? {};
      return {
        ...campaignConfig,
        enabled:
          campaignConfig.enabled === true &&
          listRunnableTlonAccountIds(cfg).length === 1,
      };
    },
    busy: () => deps.busy() || runningJobs.size > 0,
    hasTask: async () => {
      const cron = getTlonCronService();
      if (!cron) throw new Error('Campaign deferred: cron service unavailable');
      return (await cron.list({ includeDisabled: true })).some(
        isUserRecurringTask
      );
    },
    readMarker: (key) =>
      scope(async () => {
        const { posts } = await getChannelPosts({
          channelId: deps.owner,
          mode: 'newest',
          count: 50,
        });
        const post = posts.find(
          (post) =>
            post.authorId === deps.bot &&
            (post.blob ? parsePostBlob(post.blob) : [])?.some(
              (entry) =>
                entry.type === 'tlon-agent-post-marker' && entry.key === key
            )
        );
        return post ? Number(post.sentAt) : undefined;
      }),
    send: (text, key) =>
      scope(async () => {
        deps.signal?.throwIfAborted();
        await sendDm({
          fromShip: deps.bot,
          toShip: deps.owner,
          text,
          botProfile: deps.botProfile(),
          ...(key
            ? {
                blob: appendToPostBlob(undefined, {
                  type: 'tlon-agent-post-marker',
                  version: 1,
                  key,
                }),
              }
            : {}),
        });
      }),
    report: (event) =>
      deps.telemetry?.captureOnboardingCampaign({
        ...event,
        ownerShip: deps.owner,
        botShip: deps.bot,
        accountId: deps.accountId,
      }),
    error: deps.error,
    signal: deps.signal,
  });
  const onCron = (event: PluginHookCronChangedEvent) => {
    if (event.action === 'started') runningJobs.add(event.jobId);
    if (event.action === 'finished' || event.action === 'removed')
      runningJobs.delete(event.jobId);
    if (
      (event.action === 'added' || event.action === 'updated') &&
      event.job &&
      isUserRecurringTask(event.job)
    ) {
      void campaign.taskCreated().catch(deps.error);
    } else if (event.action !== 'started') void campaign.check();
  };
  return {
    ...campaign,
    start() {
      observers.set(deps.accountId, onCron);
      campaign.start();
    },
    async stop() {
      if (observers.get(deps.accountId) === onCron)
        observers.delete(deps.accountId);
      await campaign.stop();
    },
  };
}
