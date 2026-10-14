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

const observers = sharedMap<
  string,
  (event: PluginHookCronChangedEvent) => void
>('onboardingCampaign.cronObservers');
const ONBOARDING_QA_CONFIG = 'onboarding-qa-stack';
const ONBOARDING_QA_ENROLL_AFTER = '2026-09-25T00:00:00Z';

export function resolveCampaignConfig(
  config: OpenClawConfig,
  deploymentConfig = process.env.TLON_CONFIG
): CampaignConfig {
  const configured =
    (
      config.channels?.tlon as
        | { onboardingCampaign?: CampaignConfig }
        | undefined
    )?.onboardingCampaign ?? {};
  const campaign =
    deploymentConfig === ONBOARDING_QA_CONFIG
      ? {
          ...configured,
          enabled: true,
          enrollAfter: configured.enrollAfter ?? ONBOARDING_QA_ENROLL_AFTER,
          testing: {
            ...configured.testing,
            intervalMinutes: 60,
            ignoreLocalDeliveryWindow: true,
          },
        }
      : configured;
  return {
    ...campaign,
    enabled:
      campaign.enabled === true &&
      listRunnableTlonAccountIds(config).length === 1,
  };
}

export function notifyCampaignCronChanged(event: PluginHookCronChangedEvent) {
  for (const observer of observers.values()) observer(event);
}

export function isUserRecurringTask(job: PluginHookGatewayCronJob): boolean {
  return (
    (job.schedule?.kind === 'cron' || job.schedule?.kind === 'every') &&
    job.payload?.kind !== 'heartbeat' &&
    !job.description?.startsWith('tlon-internal:')
  );
}

function isPrivateOwnerBotConversation(
  group: Awaited<ReturnType<typeof getGroup>>,
  channelId: string,
  owner: string,
  bot: string
): boolean {
  return (
    (group.privacy === 'private' || group.privacy === 'secret') &&
    Boolean(
      group.members?.some(
        (member) => member.contactId === owner && member.status === 'joined'
      )
    ) &&
    !group.members?.some(
      (member) => member.contactId !== owner && member.contactId !== bot
    ) &&
    Boolean(group.channels?.some((channel) => channel.id === channelId))
  );
}

function toCampaignTask(job: PluginHookGatewayCronJob): CampaignTask {
  const completedAt =
    job.state?.lastRunAtMs === undefined
      ? undefined
      : job.state.lastRunAtMs + (job.state.lastDurationMs ?? 0);
  const failed =
    job.state?.lastRunStatus === 'error' ||
    job.state?.lastDeliveryStatus === 'not-delivered' ||
    (job.state?.lastRunAtMs !== undefined &&
      job.state?.lastDelivered === false);
  const delivered =
    job.state?.lastDelivered === true ||
    job.state?.lastDeliveryStatus === 'delivered';
  return {
    id: job.id,
    name: job.name ?? 'Recurring task',
    enabled: job.enabled !== false,
    ...(failed
      ? { failedAt: completedAt }
      : delivered
        ? { deliveredAt: completedAt }
        : {}),
  };
}

function compareCampaignTaskPriority(a: CampaignTask, b: CampaignTask): number {
  return (
    Number(Boolean(b.failedAt)) - Number(Boolean(a.failedAt)) ||
    (b.failedAt ?? b.deliveredAt ?? 0) - (a.failedAt ?? a.deliveredAt ?? 0)
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
  log?: (message: string) => void;
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
      return isPrivateOwnerBotConversation(
        group,
        state.channelId,
        deps.owner,
        deps.bot
      )
        ? state.channelId
        : deps.owner;
    });
  const readAuthenticatedOnboardingChoices = (state: CampaignState) =>
    scope(async () => {
      if (!state.channelId) return {};
      const { posts } = await getChannelPosts({
        channelId: state.channelId,
        mode: 'newest',
        count: 100,
      });
      const choices: Pick<CampaignState, 'topic' | 'purpose'> = {};
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
                e.type === 'tlon-agent-post-marker' && e.key === 'topics-picker'
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
    });
  const campaign = createCampaign({
    owner: deps.owner,
    config: () => resolveCampaignConfig(deps.config()),
    busy: () => deps.busy() || runningJobs.size > 0,
    task: async () =>
      (await jobs()).map(toCampaignTask).sort(compareCampaignTaskPriority)[0],
    destination,
    personalize: (draft) =>
      io(() =>
        personalizeTip(draft, deps.config(), deps.accountId, deps.signal)
      ),
    context: readAuthenticatedOnboardingChoices,
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
      const config = resolveCampaignConfig(deps.config());
      deps.log?.(
        `[tlon] onboarding campaign config deployment=${process.env.TLON_CONFIG ?? 'default'} enabled=${config.enabled === true} intervalMinutes=${config.testing?.intervalMinutes ?? 'production'}`
      );
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
