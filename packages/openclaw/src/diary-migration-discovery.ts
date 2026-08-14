import type { OpenClawConfig } from 'openclaw/plugin-sdk/core';

import { hasAmbiguousMigrationAccount } from './migration-account-safety.js';
import {
  type ApprovalCommandBridge,
  getAllBridges,
  getBridge,
} from './monitor/command-bridge.js';
import {
  type BuildMigrateCard,
  buildMigrateCard,
} from './monitor/migrate-card.js';
import { sharedMap } from './shared-state.js';
import { canonicalizeNest, normalizeShip, parseNest } from './targets.js';

export type SendOwnerNotification = (
  message: string,
  blob?: string
) => Promise<string | undefined>;

export type DiaryMigrationDiscoveryDeps = {
  buildCard?: BuildMigrateCard;
  logError?: (message: string) => void;
  notified?: Map<string, true>;
  inFlight?: Map<string, Promise<boolean>>;
};

const processNotified = sharedMap<string, true>(
  'diary-migration-discovery.notified'
);
const processInFlight = sharedMap<string, Promise<boolean>>(
  'diary-migration-discovery.in-flight'
);
const ARCHIVE_TITLE_SUFFIX = '-ARCHIVE';

export class DiaryMigrationDiscoveryNotifier {
  private readonly buildCard: BuildMigrateCard;
  private readonly logError?: (message: string) => void;
  private readonly notified: Map<string, true>;
  private readonly inFlight: Map<string, Promise<boolean>>;

  constructor(deps: DiaryMigrationDiscoveryDeps = {}) {
    this.buildCard = deps.buildCard ?? buildMigrateCard;
    this.logError = deps.logError;
    this.notified = deps.notified ?? processNotified;
    this.inFlight = deps.inFlight ?? processInFlight;
  }

  async notify(
    nest: string,
    sendOwnerNotification?: SendOwnerNotification,
    sourceTitle?: string,
    accountId?: string
  ): Promise<boolean> {
    const canonical = canonicalizeNest(nest);
    if (
      !sendOwnerNotification ||
      !canonical?.startsWith('diary/') ||
      !canonical
    ) {
      return false;
    }
    const cacheKey = accountId ? `${accountId}\u0000${canonical}` : canonical;
    if (this.notified.has(cacheKey)) {
      return false;
    }

    const pending = this.inFlight.get(cacheKey);
    if (pending) {
      await pending;
      return false;
    }

    const task = this.send(
      canonical,
      cacheKey,
      sendOwnerNotification,
      sourceTitle
    );
    this.inFlight.set(cacheKey, task);
    try {
      return await task;
    } finally {
      if (this.inFlight.get(cacheKey) === task) {
        this.inFlight.delete(cacheKey);
      }
    }
  }

  private async send(
    nest: string,
    cacheKey: string,
    sendOwnerNotification: SendOwnerNotification,
    sourceTitle?: string
  ): Promise<boolean> {
    const command = `/migrate ${nest}`;
    const title = sourceTitle?.trim();
    if (!title) {
      return false;
    }
    const isArchived = title.endsWith(ARCHIVE_TITLE_SUFFIX);
    const canOfferMigration = !isArchived;
    // The archived notice names the remedy as well as the problem: a diary can
    // carry this suffix without having been migrated, and that owner has no
    // terminal to investigate with. Note that renaming will not re-offer the
    // card until the gateway restarts, because this dedup is process memory.
    let blob: string | undefined;
    if (canOfferMigration) {
      try {
        blob = this.buildCard(command, { title });
      } catch (error) {
        this.logError?.(
          `Failed to build diary migration discovery card: ${String(error)}`
        );
      }
    }
    // Every recorded delivery has to be actionable, because a successful send
    // sets `notified` and suppresses every later attempt until restart. The
    // card normally carries the command, so when it fails to build the text
    // must carry it instead — otherwise the owner gets a dead-end DM and no retry.
    const message = !canOfferMigration
      ? `Found legacy diary \`${nest}\`, but its title already ends in \`${ARCHIVE_TITLE_SUFFIX}\`, ` +
        'so it looks like it has already been migrated and no action was offered. ' +
        `If it has not been migrated, rename the channel to remove \`${ARCHIVE_TITLE_SUFFIX}\` and it can be migrated again.`
      : blob
        ? `Diary migration available for "${title}"`
        : `Diary migration available for "${title}" — to migrate, type \`${command}\``;

    try {
      const messageId = await sendOwnerNotification(message, blob);
      if (!messageId) {
        return false;
      }
      this.notified.set(cacheKey, true);
      return true;
    } catch (error) {
      this.logError?.(
        `Failed to send diary migration discovery notification: ${String(error)}`
      );
      return false;
    }
  }
}

export const diaryMigrationDiscoveryNotifier =
  new DiaryMigrationDiscoveryNotifier();

function resolveDiaryMigrationBridge(
  nest: string,
  cfg: OpenClawConfig,
  accountId?: string
): ApprovalCommandBridge | null {
  const hostShip = parseNest(nest)?.hostShip;
  if (!hostShip) {
    return null;
  }
  let bridge: ApprovalCommandBridge | null = null;
  if (accountId) {
    bridge = getBridge(accountId);
  } else {
    if (hasAmbiguousMigrationAccount(cfg)) {
      return null;
    }
    const bridges = [...getAllBridges().values()];
    if (bridges.length !== 1) {
      return null;
    }
    bridge = bridges[0] ?? null;
  }
  return bridge &&
    (normalizeShip(bridge.botShip) === hostShip ||
      (bridge.ownerShip != null &&
        normalizeShip(bridge.ownerShip) === hostShip))
    ? bridge
    : null;
}

export async function notifyDiaryMigrationDiscovery(
  nest: string,
  cfg: OpenClawConfig,
  notifier = diaryMigrationDiscoveryNotifier,
  accountId?: string
): Promise<boolean> {
  const bridge = resolveDiaryMigrationBridge(nest, cfg, accountId);
  return notifier.notify(
    nest,
    bridge?.ownerShip
      ? (message, blob) => bridge.sendOwnerNotification(message, blob)
      : undefined,
    bridge?.getChannelTitle(nest),
    accountId
  );
}
