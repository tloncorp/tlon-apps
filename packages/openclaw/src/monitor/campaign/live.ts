import {
  appendToPostBlob,
  getChannelPosts,
  getGroup,
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
import { type BotProfile, sendDm, sendChannelPost } from '../../urbit/send.js';
import { markdownToStory } from '../../urbit/story.js';
import {
  type CampaignTask,
  type CampaignState,
  type CampaignConfig,
} from './model.js';
import { createCampaign } from './runner.js';
import { personalizeTip } from './personalize.js';

const replyObservers = sharedMap<
  string,
  (text: string, destination: string) => Promise<void>
>('onboardingCampaign.replyObservers');
export async function notifyCampaignReply(
  accountId: string,
  text: string,
  destination: string
) {
  await replyObservers.get(accountId)?.(
    text,
    destination.replace(/^tlon:/, '')
  );
}

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
  // API helpers do not all expose transport cancellation. Release the monitor
  // immediately on abort and prevent continuation into further campaign I/O.
  const io = <T>(fn: () => Promise<T>): Promise<T> => {
    const signal = deps.signal;
    if (!signal) return fn();
    if (signal.aborted) return Promise.reject(signal.reason);
    return new Promise<T>((resolve, reject) => {
      const abort = () => reject(signal.reason);
      signal.addEventListener('abort', abort, { once: true });
      Promise.resolve()
        .then(() => {
          signal.throwIfAborted();
          return fn();
        })
        .then(resolve, reject)
        .finally(() => signal.removeEventListener('abort', abort));
    });
  };
  const scope = <T>(fn: () => Promise<T>): Promise<T> => {
    if (!capturedScope)
      return Promise.reject(new Error('Campaign API scope unavailable'));
    return io(() => capturedScope(fn));
  };
  const runningJobs = new Set<string>();
  const jobs = async () => {
    const cron = getTlonCronService();
    if (!cron) throw new Error('Campaign deferred: cron service unavailable');
    return (await io(() => cron.list({ includeDisabled: true }))).filter(
      isUserRecurringTask
    );
  };
  const destination = (state: CampaignState) =>
    scope(async () => {
      if (
        state.destination === deps.owner ||
        !state.groupId ||
        !state.channelId
      )
        return deps.owner;
      const group = await getGroup(state.groupId);
      // Invitations count too: a third person must never receive personal tips.
      if (
        (group.privacy !== 'private' && group.privacy !== 'secret') ||
        !group.members?.some(
          (member) =>
            member.contactId === deps.owner && member.status === 'joined'
        ) ||
        group.members.some(
          (member) =>
            member.contactId !== deps.owner && member.contactId !== deps.bot
        )
      )
        return deps.owner;
      return state.channelId;
    });
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
    hasTask: async () => (await jobs()).length > 0,
    task: async () => {
      // Failed work takes precedence over another task's successful result.
      const tasks: CampaignTask[] = (await jobs()).map((job) => ({
        id: job.id,
        name: job.name ?? 'Recurring task',
        enabled: job.enabled !== false,
        ...(job.state?.lastRunStatus === 'error' ||
        job.state?.lastDeliveryStatus === 'not-delivered'
          ? {
              failedAt:
                job.state.lastRunAtMs === undefined
                  ? undefined
                  : job.state.lastRunAtMs + (job.state.lastDurationMs ?? 0),
            }
          : job.state?.lastDelivered === true ||
              job.state?.lastDeliveryStatus === 'delivered'
            ? {
                deliveredAt:
                  job.state.lastRunAtMs === undefined
                    ? undefined
                    : job.state.lastRunAtMs + (job.state.lastDurationMs ?? 0),
              }
            : {}),
      }));
      return tasks.sort(
        (a, b) =>
          Number(Boolean(b.failedAt)) - Number(Boolean(a.failedAt)) ||
          (b.failedAt ?? b.deliveredAt ?? 0) -
            (a.failedAt ?? a.deliveredAt ?? 0)
      )[0];
    },
    destination,
    personalize: (draft) =>
      io(() =>
        personalizeTip(draft, deps.config(), deps.accountId, deps.signal)
      ),
    context: (state) =>
      scope(async () => {
        if (!state.channelId) return {};
        const { posts } = await getChannelPosts({
          channelId: state.channelId,
          mode: 'newest',
          count: 100,
        });
        const choices: Pick<CampaignState, 'topic' | 'purpose'> = {};
        // Topics come from authenticated, structured onboarding choices, not generated summaries.
        for (const post of [...posts].sort(
          (a, b) => Number(b.sentAt) - Number(a.sentAt)
        )) {
          if (post.authorId !== deps.owner || !post.blob) continue;
          for (const entry of parsePostBlob(post.blob) ?? []) {
            if (entry.type === 'tlon-agent-provision') {
              choices.topic ??= entry.topics.join(', ');
            }
            if (entry.type !== 'tlon-a2ui-selection' || !entry.sourcePostId)
              continue;
            const source = posts.find(
              (p) => p.id === entry.sourcePostId && p.authorId === deps.bot
            );
            if (
              source?.blob &&
              (parsePostBlob(source.blob) ?? []).some(
                (e) =>
                  e.type === 'tlon-agent-post-marker' &&
                  e.key === 'topics-picker'
              )
            )
              choices.topic ??= entry.values.join(', ');
            if (
              source?.blob &&
              (parsePostBlob(source.blob) ?? []).some(
                (e) =>
                  e.type === 'tlon-agent-post-marker' &&
                  e.key === 'purpose-picker'
              )
            )
              choices.purpose ??= entry.values.join(', ');
          }
        }
        return choices;
      }),
    readMarker: (key, conversation = deps.owner) =>
      scope(async () => {
        const { posts } = await getChannelPosts({
          channelId: conversation,
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
    send: (text, key, conversation = deps.owner) =>
      scope(async () => {
        deps.signal?.throwIfAborted();
        const blob = key
          ? appendToPostBlob(undefined, {
              type: 'tlon-agent-post-marker',
              version: 1,
              key,
            })
          : undefined;
        const profile = {
          fromShip: deps.bot,
          botProfile: deps.botProfile(),
          blob,
        };
        if (conversation === deps.owner)
          await sendDm({ ...profile, toShip: deps.owner, text });
        else
          await sendChannelPost({
            ...profile,
            nest: conversation,
            story: markdownToStory(text),
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
    }
  };
  return {
    ...campaign,
    start() {
      observers.set(deps.accountId, onCron);
      replyObservers.set(deps.accountId, campaign.observeReply);
      campaign.start();
    },
    async stop() {
      if (observers.get(deps.accountId) === onCron)
        observers.delete(deps.accountId);
      if (replyObservers.get(deps.accountId) === campaign.observeReply)
        replyObservers.delete(deps.accountId);
      await campaign.stop();
    },
  };
}
