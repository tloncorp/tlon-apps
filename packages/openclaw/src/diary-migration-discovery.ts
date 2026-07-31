import type { OpenClawConfig } from 'openclaw/plugin-sdk/core';

import { MIGRATION_DROP_WARNING } from './migrate-command.js';
import { hasAmbiguousMigrationAccount } from './migration-account-safety.js';
import {
  type ApprovalCommandBridge,
  getAllBridges,
} from './monitor/command-bridge.js';
import { buildMigrateCard } from './monitor/migrate-card.js';
import { sharedMap } from './shared-state.js';
import { canonicalizeNest, normalizeShip, parseNest } from './targets.js';

export type SendOwnerNotification = (
  message: string,
  blob?: string
) => Promise<string | undefined>;

export type DiaryMigrationDiscoveryDeps = {
  buildCard?: (command: string) => string;
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
  private readonly buildCard: (command: string) => string;
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
    sourceTitle?: string
  ): Promise<boolean> {
    const canonical = canonicalizeNest(nest);
    if (
      !sendOwnerNotification ||
      !canonical?.startsWith('diary/') ||
      this.notified.has(canonical)
    ) {
      return false;
    }

    const pending = this.inFlight.get(canonical);
    if (pending) {
      await pending;
      return false;
    }

    const task = this.send(canonical, sendOwnerNotification, sourceTitle);
    this.inFlight.set(canonical, task);
    try {
      return await task;
    } finally {
      if (this.inFlight.get(canonical) === task) {
        this.inFlight.delete(canonical);
      }
    }
  }

  private async send(
    nest: string,
    sendOwnerNotification: SendOwnerNotification,
    sourceTitle?: string
  ): Promise<boolean> {
    const command = `/migrate ${nest}`;
    const title = sourceTitle?.trim();
    const isArchived = title?.endsWith(ARCHIVE_TITLE_SUFFIX) ?? false;
    const canOfferMigration = Boolean(title) && !isArchived;
    const message = canOfferMigration
      ? `Migrate this diary: \`${command}\`\n\n${MIGRATION_DROP_WARNING}`
      : isArchived
        ? `Found legacy diary \`${nest}\`, but its title already ends in \`${ARCHIVE_TITLE_SUFFIX}\`. No migration action was offered.`
        : `Found legacy diary \`${nest}\`, but its current title is not available in the existing channel cache. No migration action was offered.`;
    let blob: string | undefined;
    if (canOfferMigration) {
      try {
        blob = this.buildCard(command);
      } catch (error) {
        this.logError?.(
          `Failed to build diary migration discovery card: ${String(error)}`
        );
      }
    }

    try {
      const messageId = await sendOwnerNotification(message, blob);
      if (!messageId) {
        return false;
      }
      this.notified.set(nest, true);
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
  cfg: OpenClawConfig
): ApprovalCommandBridge | null {
  if (hasAmbiguousMigrationAccount(cfg)) {
    return null;
  }
  const bridges = [...getAllBridges().values()];
  if (bridges.length !== 1) {
    return null;
  }

  const hostShip = parseNest(nest)?.hostShip;
  if (!hostShip) {
    return null;
  }
  const bridge = bridges[0];
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
  notifier = diaryMigrationDiscoveryNotifier
): Promise<boolean> {
  const bridge = resolveDiaryMigrationBridge(nest, cfg);
  return notifier.notify(
    nest,
    bridge?.ownerShip
      ? (message, blob) => bridge.sendOwnerNotification(message, blob)
      : undefined,
    bridge?.getChannelTitle(nest)
  );
}
