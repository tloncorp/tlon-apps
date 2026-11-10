import {
  type ChannelSetupAdapter,
  type ChannelSetupInput,
  type ChannelSetupWizard,
  DEFAULT_ACCOUNT_ID,
  type OpenClawConfig,
  formatDocsLink,
  normalizeAccountId,
  patchScopedAccountConfig,
  prepareScopedSetupConfig,
} from 'openclaw/plugin-sdk/setup';

import { buildTlonAccountFields } from './account-fields.js';
import { normalizeShip } from './targets.js';
import {
  type TlonResolvedAccount,
  listTlonAccountIds,
  resolveTlonAccount,
} from './types.js';
import { validateUrbitBaseUrl } from './urbit/base-url.js';

function tlonChannelId() {
  return 'tlon' as const;
}

export type TlonSetupInput = ChannelSetupInput & {
  ship?: string;
  url?: string;
  code?: string;
  allowPrivateNetwork?: boolean;
  groupChannels?: string[];
  dmAllowlist?: string[];
  autoDiscoverChannels?: boolean;
  ownerShip?: string;
};

function isConfigured(account: TlonResolvedAccount): boolean {
  return Boolean(account.ship && account.url && account.code);
}

type TlonSetupWizardBaseParams = {
  resolveConfigured: (params: {
    cfg: OpenClawConfig;
    accountId?: string;
  }) => boolean | Promise<boolean>;
  resolveStatusLines?: (params: {
    cfg: OpenClawConfig;
    accountId?: string;
    configured: boolean;
  }) => string[] | Promise<string[]>;
  finalize: NonNullable<ChannelSetupWizard['finalize']>;
};

export function createTlonSetupWizardBase(
  params: TlonSetupWizardBaseParams
): ChannelSetupWizard {
  return {
    channel: tlonChannelId(),
    status: {
      configuredLabel: 'configured',
      unconfiguredLabel: 'needs setup',
      configuredHint: 'configured',
      unconfiguredHint: 'urbit messenger',
      configuredScore: 1,
      unconfiguredScore: 4,
      resolveConfigured: ({ cfg, accountId }) =>
        params.resolveConfigured({ cfg, accountId }),
      resolveStatusLines: ({ cfg, accountId, configured }) =>
        params.resolveStatusLines?.({ cfg, accountId, configured }) ?? [],
    },
    introNote: {
      title: 'Tlon setup',
      lines: [
        'You need your Urbit ship URL and login code.',
        'Example URL: https://your-ship-host',
        'Example ship: ~sampel-palnet',
        'If your ship URL is on a private network (LAN/localhost), you must explicitly allow it during setup.',
        `Docs: ${formatDocsLink('/channels/tlon', 'channels/tlon')}`,
      ],
    },
    credentials: [],
    textInputs: [
      {
        inputKey: 'ship',
        message: 'Ship name',
        placeholder: '~sampel-palnet',
        currentValue: ({ cfg, accountId }) =>
          resolveTlonAccount(cfg, accountId).ship ?? undefined,
        validate: ({ value }) =>
          String(value ?? '').trim() ? undefined : 'Required',
        normalizeValue: ({ value }) => normalizeShip(String(value).trim()),
        applySet: async ({ cfg, accountId, value }) =>
          applyTlonSetupConfig({
            cfg,
            accountId,
            input: { ship: value },
          }),
      },
      {
        inputKey: 'url',
        message: 'Ship URL',
        placeholder: 'https://your-ship-host',
        currentValue: ({ cfg, accountId }) =>
          resolveTlonAccount(cfg, accountId).url ?? undefined,
        validate: ({ value }) => {
          const next = validateUrbitBaseUrl(String(value ?? ''));
          if (!next.ok) {
            return next.error;
          }
          return undefined;
        },
        normalizeValue: ({ value }) => String(value).trim(),
        applySet: async ({ cfg, accountId, value }) =>
          applyTlonSetupConfig({
            cfg,
            accountId,
            input: { url: value },
          }),
      },
      {
        inputKey: 'code',
        message: 'Login code',
        placeholder: 'lidlut-tabwed-pillex-ridrup',
        sensitive: true,
        keepPrompt: 'Login code already configured. Keep it?',
        currentValue: ({ cfg, accountId }) =>
          resolveTlonAccount(cfg, accountId).code ?? undefined,
        validate: ({ value }) =>
          String(value ?? '').trim() ? undefined : 'Required',
        normalizeValue: ({ value }) => String(value).trim(),
        applySet: async ({ cfg, accountId, value }) =>
          applyTlonSetupConfig({
            cfg,
            accountId,
            input: { code: value },
          }),
      },
    ],
    finalize: params.finalize,
  };
}

export async function resolveTlonSetupConfigured(
  cfg: OpenClawConfig,
  accountId?: string
): Promise<boolean> {
  if (accountId) {
    return isConfigured(resolveTlonAccount(cfg, accountId));
  }
  const accountIds = listTlonAccountIds(cfg);
  return accountIds.length > 0
    ? accountIds.some((resolvedAccountId) =>
        isConfigured(resolveTlonAccount(cfg, resolvedAccountId))
      )
    : isConfigured(resolveTlonAccount(cfg, DEFAULT_ACCOUNT_ID));
}

export async function resolveTlonSetupStatusLines(
  cfg: OpenClawConfig,
  accountId?: string
): Promise<string[]> {
  const configured = await resolveTlonSetupConfigured(cfg, accountId);
  const label =
    accountId && accountId !== DEFAULT_ACCOUNT_ID
      ? `Tlon (${accountId})`
      : 'Tlon';
  return [`${label}: ${configured ? 'configured' : 'needs setup'}`];
}

export function applyTlonSetupConfig(params: {
  cfg: OpenClawConfig;
  accountId: string;
  input: TlonSetupInput;
}): OpenClawConfig {
  const { cfg, accountId, input } = params;
  const useDefault = accountId === DEFAULT_ACCOUNT_ID;
  const namedConfig = prepareScopedSetupConfig({
    cfg,
    channelKey: tlonChannelId(),
    accountId,
    name: input.name,
  });
  const base = namedConfig.channels?.tlon ?? {};
  const payload = buildTlonAccountFields(input);

  if (useDefault) {
    return {
      ...namedConfig,
      channels: {
        ...namedConfig.channels,
        tlon: {
          ...base,
          enabled: true,
          ...payload,
        },
      },
    };
  }

  return patchScopedAccountConfig({
    cfg: namedConfig,
    channelKey: tlonChannelId(),
    accountId,
    patch: { enabled: base.enabled ?? true },
    accountPatch: {
      enabled: true,
      ...payload,
    },
    ensureChannelEnabled: false,
    ensureAccountEnabled: false,
  });
}

export const tlonSetupAdapter: ChannelSetupAdapter = {
  resolveAccountId: ({ accountId }) => normalizeAccountId(accountId),
  applyAccountName: ({ cfg, accountId, name }) =>
    prepareScopedSetupConfig({
      cfg,
      channelKey: tlonChannelId(),
      accountId,
      name,
    }),
  validateInput: ({ cfg, accountId, input }) => {
    const setupInput = input as TlonSetupInput;
    const resolved = resolveTlonAccount(cfg, accountId ?? undefined);
    // `??`, not `||`: an explicitly empty flag is an error, not a fallback
    // to the configured value.
    const ship = (setupInput.ship ?? resolved.ship)?.trim();
    const url = (setupInput.url ?? resolved.url)?.trim();
    const code = (setupInput.code ?? resolved.code)?.trim();
    if (!ship) {
      return 'Tlon requires --ship.';
    }
    if (!url) {
      return 'Tlon requires --url.';
    }
    const validatedUrl = validateUrbitBaseUrl(url);
    if (!validatedUrl.ok) {
      return `Invalid URL: ${validatedUrl.error}`;
    }
    if (!code) {
      return 'Tlon requires --code.';
    }
    return null;
  },
  applyAccountConfig: ({ cfg, accountId, input }) =>
    applyTlonSetupConfig({
      cfg,
      accountId,
      input: input as TlonSetupInput,
    }),
};
