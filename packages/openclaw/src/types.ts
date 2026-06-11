import type { OpenClawConfig } from "openclaw/plugin-sdk/core";

export type TlonTelemetryConfig = {
  enabled: boolean;
  apiKey: string | null;
  host: string | null;
};

export type TlonResolvedAccount = {
  accountId: string;
  name: string | null;
  enabled: boolean;
  configured: boolean;
  ship: string | null;
  url: string | null;
  code: string | null;
  allowPrivateNetwork: boolean | null;
  groupChannels: string[];
  dmAllowlist: string[];
  /** Ships allowed to invite us to groups (security: prevent malicious group invites) */
  groupInviteAllowlist: string[];
  autoDiscoverChannels: boolean | null;
  showModelSignature: boolean | null;
  autoAcceptDmInvites: boolean | null;
  autoAcceptGroupInvites: boolean | null;
  defaultAuthorizedShips: string[];
  /** Ship that receives approval requests for DMs, channel mentions, and group invites */
  ownerShip: string | null;
  /** Controls agent reaction behavior: off | ack | minimal | extensive (default: minimal) */
  reactionLevel: string | null;
  /** Max consecutive responses to another bot before stopping (default: 3) */
  maxConsecutiveBotResponses: number | null;
  telemetry: TlonTelemetryConfig;
  /** Global owner-listen toggle (default true). */
  ownerListenEnabled: boolean | null;
  /** Channels opted out of owner-listen even when the global toggle is on. */
  ownerListenDisabledChannels: string[];
};

type TlonTelemetryInput = {
  enabled?: boolean;
  apiKey?: string;
  host?: string;
};

function resolveTelemetryConfig(
  base: TlonTelemetryInput | null | undefined,
  account: TlonTelemetryInput | null | undefined,
): TlonTelemetryConfig {
  return {
    enabled: account?.enabled ?? base?.enabled ?? false,
    apiKey: account?.apiKey ?? base?.apiKey ?? null,
    host: account?.host ?? base?.host ?? null,
  };
}

export function resolveTlonAccount(
  cfg: OpenClawConfig,
  accountId?: string | null,
): TlonResolvedAccount {
  const base = cfg.channels?.tlon as
    | {
        name?: string;
        enabled?: boolean;
        ship?: string;
        url?: string;
        code?: string;
        network?: { dangerouslyAllowPrivateNetwork?: boolean };
        /** @deprecated Use `network.dangerouslyAllowPrivateNetwork`. */
        allowPrivateNetwork?: boolean;
        groupChannels?: string[];
        dmAllowlist?: string[];
        groupInviteAllowlist?: string[];
        autoDiscoverChannels?: boolean;
        showModelSignature?: boolean;
        autoAcceptDmInvites?: boolean;
        autoAcceptGroupInvites?: boolean;
        ownerShip?: string;
        reactionLevel?: string;
        maxConsecutiveBotResponses?: number;
        telemetry?: TlonTelemetryInput;
        ownerListenEnabled?: boolean;
        ownerListenDisabledChannels?: string[];
        accounts?: Record<string, Record<string, unknown>>;
      }
    | undefined;

  if (!base) {
    return {
      accountId: accountId || "default",
      name: null,
      enabled: false,
      configured: false,
      ship: null,
      url: null,
      code: null,
      allowPrivateNetwork: null,
      groupChannels: [],
      dmAllowlist: [],
      groupInviteAllowlist: [],
      autoDiscoverChannels: null,
      showModelSignature: null,
      autoAcceptDmInvites: null,
      autoAcceptGroupInvites: null,
      defaultAuthorizedShips: [],
      ownerShip: null,
      reactionLevel: null,
      maxConsecutiveBotResponses: null,
      telemetry: {
        enabled: false,
        apiKey: null,
        host: null,
      },
      ownerListenEnabled: null,
      ownerListenDisabledChannels: [],
    };
  }

  const useDefault = !accountId || accountId === "default";
  const account = useDefault ? base : base.accounts?.[accountId];

  const ship = (account?.ship ?? base.ship ?? null) as string | null;
  const url = (account?.url ?? base.url ?? null) as string | null;
  const code = (account?.code ?? base.code ?? null) as string | null;
  const accountNetwork = (account as { network?: { dangerouslyAllowPrivateNetwork?: boolean } })
    ?.network;
  const accountAllowPrivateNetwork = (account as { allowPrivateNetwork?: boolean })
    ?.allowPrivateNetwork;
  const allowPrivateNetwork = (accountNetwork?.dangerouslyAllowPrivateNetwork ??
    accountAllowPrivateNetwork ??
    base.network?.dangerouslyAllowPrivateNetwork ??
    base.allowPrivateNetwork ??
    null) as boolean | null;
  const groupChannels = (account?.groupChannels ?? base.groupChannels ?? []) as string[];
  const dmAllowlist = (account?.dmAllowlist ?? base.dmAllowlist ?? []) as string[];
  const groupInviteAllowlist = (account?.groupInviteAllowlist ??
    base.groupInviteAllowlist ??
    []) as string[];
  const autoDiscoverChannels = (account?.autoDiscoverChannels ??
    base.autoDiscoverChannels ??
    null) as boolean | null;
  const showModelSignature = (account?.showModelSignature ?? base.showModelSignature ?? null) as
    | boolean
    | null;
  const autoAcceptDmInvites = (account?.autoAcceptDmInvites ?? base.autoAcceptDmInvites ?? null) as
    | boolean
    | null;
  const autoAcceptGroupInvites = (account?.autoAcceptGroupInvites ??
    base.autoAcceptGroupInvites ??
    null) as boolean | null;
  const ownerShip = (account?.ownerShip ?? base.ownerShip ?? null) as string | null;
  const reactionLevel = (account?.reactionLevel ?? base.reactionLevel ?? null) as string | null;
  const maxConsecutiveBotResponses = ((account as Record<string, unknown>)
    ?.maxConsecutiveBotResponses ??
    base.maxConsecutiveBotResponses ??
    null) as number | null;
  const telemetry = resolveTelemetryConfig(
    base.telemetry,
    (account as { telemetry?: TlonTelemetryInput } | undefined)?.telemetry,
  );
  const defaultAuthorizedShips = ((account as Record<string, unknown>)?.defaultAuthorizedShips ??
    (base as Record<string, unknown>)?.defaultAuthorizedShips ??
    []) as string[];
  const ownerListenEnabled = ((account as Record<string, unknown>)?.ownerListenEnabled ??
    (base as Record<string, unknown>)?.ownerListenEnabled ??
    null) as boolean | null;
  const ownerListenDisabledChannels = ((account as Record<string, unknown>)
    ?.ownerListenDisabledChannels ??
    (base as Record<string, unknown>)?.ownerListenDisabledChannels ??
    []) as string[];
  const configured = Boolean(ship && url && code);

  return {
    accountId: accountId || "default",
    name: (account?.name ?? base.name ?? null) as string | null,
    enabled: (account?.enabled ?? base.enabled ?? true) !== false,
    configured,
    ship,
    url,
    code,
    allowPrivateNetwork,
    groupChannels,
    dmAllowlist,
    groupInviteAllowlist,
    autoDiscoverChannels,
    showModelSignature,
    autoAcceptDmInvites,
    autoAcceptGroupInvites,
    defaultAuthorizedShips,
    ownerShip,
    reactionLevel,
    maxConsecutiveBotResponses,
    telemetry,
    ownerListenEnabled,
    ownerListenDisabledChannels,
  };
}

export function listTlonAccountIds(cfg: OpenClawConfig): string[] {
  const base = cfg.channels?.tlon as
    | { ship?: string; accounts?: Record<string, Record<string, unknown>> }
    | undefined;
  if (!base) {
    return [];
  }
  const accounts = base.accounts ?? {};
  return [...(base.ship ? ["default"] : []), ...Object.keys(accounts)];
}

/**
 * Like `listTlonAccountIds`, but only includes accounts that are both
 * `enabled !== false` and fully `configured` (ship + url + code present).
 *
 * Use this when the question is "how many accounts will actually run a
 * monitor in this process". Disabled or stub accounts cannot race
 * shared-process state and should not, for example, disable the nudge
 * scheduler's single-runnable-account guard.
 */
export function listRunnableTlonAccountIds(cfg: OpenClawConfig): string[] {
  return listTlonAccountIds(cfg).filter((id) => {
    const account = resolveTlonAccount(cfg, id);
    return account.enabled && account.configured;
  });
}
