import * as React from 'react';
import { Platform } from 'react-native';

import {
  emptyReadMembership,
  readScopeDescriptor,
  reconcileReadMembership,
  type NativeReadBinding,
  type NativeReadPhase,
} from './nativeReadMetadata';
import type { NativeScrollOwnershipSnapshot } from './nativeScrollOwnership';
import type { PostWithNeighbors } from './shared';

/** One physical list owns its membership; individual rows own live content. */
export function useNativeReadScope({
  scope,
  items,
  owner,
  isFocused,
  isReady,
  isFollowing,
  diagnosticTimingSession,
}: {
  scope: string;
  items: PostWithNeighbors[];
  owner: NativeScrollOwnershipSnapshot;
  isFocused: boolean;
  isReady: boolean;
  isFollowing: boolean;
  diagnosticTimingSession?: string;
}) {
  const visit = React.useId();
  const binding = React.useMemo<NativeReadBinding>(
    () => ({ version: 1, scope, visit }),
    [scope, visit]
  );
  const keys = React.useMemo(() => items.map(({ post }) => post.id), [items]);
  const [committedMembership, setMembership] =
    React.useState(emptyReadMembership);
  const membership = reconcileReadMembership(committedMembership, keys);
  if (membership !== committedMembership) setMembership(membership);
  const phase: NativeReadPhase =
    !isFocused || !owner.active
      ? 'inactive'
      : !isReady || owner.commandPending
        ? 'target'
        : isFollowing
          ? 'follow'
          : 'read';
  const descriptor = React.useMemo(
    () =>
      readScopeDescriptor(
        binding,
        JSON.stringify([binding.scope, binding.visit, owner.revision]),
        phase,
        membership,
        diagnosticTimingSession
      ),
    [binding, owner.revision, phase, membership, diagnosticTimingSession]
  );
  const enabled = Platform.OS === 'ios';
  return {
    context: React.useMemo(
      () => (enabled ? { binding, membership } : null),
      [enabled, binding, membership]
    ),
    descriptor: enabled ? JSON.stringify(descriptor) : undefined,
    intent: enabled ? descriptor?.intent : undefined,
    // This selects the same-mount native arbiter. It does not grant a lease.
    routesReadCorrection: enabled && descriptor?.phase === 'read',
  };
}
