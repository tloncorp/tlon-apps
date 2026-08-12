import { encodeString } from '../urbit/utils';
import { scry } from './urbit';

export type GlobalSearchSource =
  | { type: 'channel'; kind: string; ship: string; name: string }
  | { type: 'dm'; ship: string }
  | { type: 'club'; id: string };

export interface GlobalSearchRef {
  source: GlobalSearchSource;
  top: string;
  reply: string | null;
}

export interface GlobalSearchHit {
  ref: GlobalSearchRef;
  sent: string;
  author: string;
  snippet: string;
}

export interface GlobalSearchPage {
  hits: GlobalSearchHit[];
  next: string | null;
  complete: boolean;
  indexed: number;
  sources: { channels: number; clubs: number; dms: number };
  builtAt: string | null;
}

export function globalSearchChannelId(source: GlobalSearchSource): string {
  switch (source.type) {
    case 'channel':
      return `${source.kind}/${source.ship}/${source.name}`;
    case 'dm':
      return source.ship;
    case 'club':
      return source.id;
  }
}

export async function searchGlobally({
  query,
  limit = 20,
  cursor,
}: {
  query: string;
  limit?: number;
  cursor?: string | null;
}): Promise<GlobalSearchPage> {
  return scry<GlobalSearchPage>({
    app: 'groups-ui',
    path: `/global-search/${limit}/${cursor ?? 'all'}/${encodeString(query)}`,
  });
}
