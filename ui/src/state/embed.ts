import create from 'zustand';
import { jsonFetch } from '@/logic/utils';

export interface EmbedState {
  embeds: {
    [url: string]: any;
  };
  getEmbed: (url: string) => Promise<any>;
  fetch: (url: string) => Promise<any>;
}

const OEMBED_PROVIDER = 'https://noembed.com/embed';

const useEmbedState = create<EmbedState>((set, get) => ({
  embeds: {},
  fetch: async (url: string) => {
    const { embeds } = get();
    if (url in embeds) {
      return embeds[url];
    }
    const search = new URLSearchParams({
      url,
    });

    const embed = await jsonFetch(`${OEMBED_PROVIDER}?${search.toString()}`);
    return embed;
  },
  getEmbed: async (url: string) => {
    const { fetch, embeds } = get();
    if (url in embeds) {
      return embeds[url];
    }
    const { embeds: es } = get();
    const embed = await fetch(url).catch((reason) => {
      throw reason;
    });
    set({ embeds: { ...es, [url]: embed } });
    return embed;
  },
}));

export default useEmbedState;
