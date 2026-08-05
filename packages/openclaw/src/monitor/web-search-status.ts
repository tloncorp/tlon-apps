/**
 * Boot-time web_search availability probe.
 *
 * The gateway resolves web_search from provider plugins loaded into its
 * registry. When a provider plugin fails to install (e.g. a broken npm cache
 * during provisioning), the registry comes up empty and the gateway disables
 * web_search without any error — the tool is simply absent, so nothing fires
 * until a user happens to ask the bot to search. Probing at gateway-connect
 * time and reporting the result on `TlonBot Gateway Connected` makes that
 * failure observable fleet-wide at provision time.
 */

export type WebSearchBootStatus = {
  /** `tools.web.search.enabled` — defaults to true when unset. */
  webSearchEnabled: boolean;
  /** `tools.web.search.provider`, or null when auto-detecting. */
  webSearchConfiguredProvider: string | null;
  /** Provider ids registered in the gateway's plugin registry, sorted. */
  webSearchProviders: string[];
  webSearchProviderCount: number;
  /**
   * True when web_search is enabled and at least one provider is registered.
   * False also covers probe failures — alert on false, filter expected
   * `webSearchEnabled: false` deployments via that field.
   */
  webSearchAvailable: boolean;
  /** Non-null when the probe itself failed (couldn't read the registry). */
  webSearchProbeError: string | null;
};

type WebSearchConfigSlice = {
  enabled?: boolean;
  provider?: string;
};

export function probeWebSearchBootStatus(params: {
  searchConfig: WebSearchConfigSlice | undefined;
  listProviders: (() => Array<{ id: string }>) | undefined;
}): WebSearchBootStatus {
  const webSearchEnabled = params.searchConfig?.enabled !== false;
  const configuredProvider =
    params.searchConfig?.provider?.trim().toLowerCase() || null;

  let providers: string[] = [];
  let probeError: string | null = null;
  if (typeof params.listProviders !== 'function') {
    probeError = 'webSearch runtime unavailable (listProviders missing)';
  } else {
    try {
      providers = [
        ...new Set(params.listProviders().map((provider) => provider.id)),
      ].sort();
    } catch (error) {
      probeError =
        error instanceof Error ? error.message || String(error) : String(error);
    }
  }

  return {
    webSearchEnabled,
    webSearchConfiguredProvider: configuredProvider,
    webSearchProviders: providers,
    webSearchProviderCount: providers.length,
    webSearchAvailable:
      probeError == null && webSearchEnabled && providers.length > 0,
    webSearchProbeError: probeError,
  };
}
