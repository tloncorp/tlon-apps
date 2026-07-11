/**
 * External-handler claims, written to Urbit's %settings store so a
 * co-resident OpenClaw gateway (logged in as the same bot ship) knows to
 * ignore messages in scopes this session has attached to.
 *
 * Storage: desk "moltbot", bucket "tlon", entry "externalClaims" — a JSON
 * string encoding ExternalClaim[]. Claims carry an expiry and are refreshed
 * at half TTL while held, so a crashed session un-mutes the bot within one
 * TTL instead of silencing it permanently.
 */
import type { EyreClient, EyreLogger } from './eyre.js';

const SETTINGS_DESK = 'moltbot';
const SETTINGS_BUCKET = 'tlon';
const CLAIMS_ENTRY_KEY = 'externalClaims';

export type ExternalClaim = {
  scope: string;
  holder: string;
  expiresAt: number;
};

export function parseClaimsValue(value: unknown): ExternalClaim[] {
  let parsed: unknown = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed.filter((item): item is ExternalClaim => {
    if (!item || typeof item !== 'object') {
      return false;
    }
    const claim = item as Record<string, unknown>;
    return (
      typeof claim.scope === 'string' &&
      typeof claim.holder === 'string' &&
      typeof claim.expiresAt === 'number'
    );
  });
}

export class ClaimManager {
  private held = new Set<string>();
  private refreshTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly eyre: EyreClient,
    private readonly holder: string,
    private readonly ttlMs: number,
    private readonly enabled: boolean,
    private readonly log: EyreLogger = () => {}
  ) {}

  async claim(scope: string): Promise<void> {
    this.held.add(scope);
    await this.sync();
    this.ensureRefreshTimer();
  }

  async release(scope: string): Promise<void> {
    this.held.delete(scope);
    await this.sync();
    if (this.held.size === 0) {
      this.stopRefreshTimer();
    }
  }

  async releaseAll(): Promise<void> {
    this.held.clear();
    this.stopRefreshTimer();
    await this.sync();
  }

  private ensureRefreshTimer(): void {
    if (this.refreshTimer || !this.enabled) {
      return;
    }
    this.refreshTimer = setInterval(() => {
      this.sync().catch((err) =>
        this.log(`[claims] Refresh failed: ${String(err)}`)
      );
    }, Math.max(this.ttlMs / 2, 10_000));
    this.refreshTimer.unref?.();
  }

  private stopRefreshTimer(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * Read-modify-write the claims entry: keep other holders' live claims,
   * replace ours with the current held set.
   */
  private async sync(): Promise<void> {
    if (!this.enabled) {
      return;
    }
    const now = Date.now();
    let existing: ExternalClaim[] = [];
    try {
      const all = await this.eyre.scry<{
        all?: Record<string, Record<string, Record<string, unknown>>>;
      }>('settings', '/all.json');
      existing = parseClaimsValue(
        all?.all?.[SETTINGS_DESK]?.[SETTINGS_BUCKET]?.[CLAIMS_ENTRY_KEY]
      );
    } catch (err) {
      this.log(`[claims] Settings scry failed (writing fresh): ${String(err)}`);
    }

    const others = existing.filter(
      (claim) => claim.holder !== this.holder && claim.expiresAt > now
    );
    const ours: ExternalClaim[] = [...this.held].map((scope) => ({
      scope,
      holder: this.holder,
      expiresAt: now + this.ttlMs,
    }));
    const next = [...others, ...ours];

    await this.eyre.poke('settings', 'settings-event', {
      'put-entry': {
        desk: SETTINGS_DESK,
        'bucket-key': SETTINGS_BUCKET,
        'entry-key': CLAIMS_ENTRY_KEY,
        value: JSON.stringify(next),
      },
    });
    this.log(
      `[claims] Synced: ${ours.length} held, ${others.length} other-holder`
    );
  }
}
