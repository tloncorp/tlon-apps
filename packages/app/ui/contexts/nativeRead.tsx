import { createContext } from 'react';

import type {
  NativeReadBinding,
  NativeReadMembership,
  NativeReadRowIdentity,
} from '../components/Channel/PostList/nativeReadMetadata';

export const NativeReadListContext = createContext<{
  binding: NativeReadBinding;
  membership: NativeReadMembership;
} | null>(null);
export const NativeReadRowContext = createContext<
  (NativeReadBinding & NativeReadRowIdentity) | null
>(null);

export type NativeReadBlockDescriptor = NativeReadBinding & {
  key: string;
  rowRevision: string;
  blockId: string;
  revision: string;
  kind: 'text' | 'media';
  assetKey?: string;
  mediaReady?: boolean;
};

/** Explicit block ownership never flows into nested content renderers. */
export const NativeReadBlockContext =
  createContext<NativeReadBlockDescriptor | null>(null);
