export type DeferredInviteSource =
  | 'install_referrer'
  | 'clipboard'
  | 'ip_match';

export interface DeferredInvite {
  url: string;
  source: DeferredInviteSource;
  matchedAfterMs?: number;
}

// deferred install attribution exists only on native — web has no
// install gap to cross
export async function resolveDeferredInvite(): Promise<DeferredInvite | null> {
  return null;
}
