/**
 * Server configuration, resolved from environment variables.
 *
 * Credential env vars follow the same conventions as @tloncorp/tlon-skill:
 * URBIT_* aliases take precedence over TLON_* for the same field.
 */

export type ServerConfig = {
  /** Ship HTTP endpoint, e.g. https://your-bot.tlon.network */
  url: string;
  /** Bot ship the server logs in as, e.g. ~sampel-palnet */
  ship: string;
  /** +code access code */
  code: string;
  /** Path to the tlon CLI binary from @tloncorp/tlon-skill (outbound sends/reads) */
  cliCommand: string;
  /** Scopes to attach on startup (comma-separated in TLON_ATTACH) */
  initialScopes: string[];
  /** Holder id written into settings-store claims */
  claimHolder: string;
  /** Claim lifetime; refreshed at half this interval while attached */
  claimTtlMs: number;
  /** Write claims to settings-store so a co-resident OpenClaw gateway ignores attached scopes */
  writeClaims: boolean;
};

export function normalizeShip(ship: string): string {
  const trimmed = ship.trim().toLowerCase();
  return trimmed.startsWith('~') ? trimmed : `~${trimmed}`;
}

function env(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.trim() !== '') {
      return value.trim();
    }
  }
  return undefined;
}

export function loadConfig(): ServerConfig {
  const url = env('URBIT_URL', 'TLON_URL');
  const ship = env('URBIT_SHIP', 'TLON_SHIP');
  const code = env('URBIT_CODE', 'TLON_CODE');

  const missing = [
    !url && 'TLON_URL',
    !ship && 'TLON_SHIP',
    !code && 'TLON_CODE',
  ].filter(Boolean);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }

  const claimTtlMs = Number(env('TLON_CLAIM_TTL_MS') ?? '') || 5 * 60 * 1000;

  return {
    url: url!.replace(/\/+$/, ''),
    ship: normalizeShip(ship!),
    code: code!,
    cliCommand: env('TLON_CLI') ?? 'tlon',
    initialScopes: (env('TLON_ATTACH') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    claimHolder: env('TLON_CLAIM_HOLDER') ?? 'claude-code',
    claimTtlMs,
    writeClaims: env('TLON_WRITE_CLAIMS') !== 'false',
  };
}
