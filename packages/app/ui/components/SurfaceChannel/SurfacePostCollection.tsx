import * as store from '@tloncorp/shared';
import type * as db from '@tloncorp/shared/db';
// eslint-disable-next-line
// @ts-ignore generated at build time by `pnpm build:surface-shell` (see the
// editor-package editorHtml precedent)
import { shellArtifactVersion } from '@tloncorp/surface-shell/artifact-strings';
import { forwardRef } from 'react';
import { YStack } from 'tamagui';

import { usePostCollectionContext } from '../../contexts/postCollection';
import { IPostCollectionView } from '../postCollectionViews/shared';
import { SurfaceSandboxContainer } from './SurfaceSandboxContainer';
import {
  SurfaceBundleUnavailableState,
  SurfaceDashboardFullBanner,
  SurfaceInvalidDefinitionState,
  SurfaceLoadingState,
  SurfaceMigrationPendingState,
  SurfaceUpdateToViewState,
} from './SurfaceStates';
import { useSurfaceBundle } from './useSurfaceBundle';
import { resolveSurfaceViewState } from './surfaceViewState';

/**
 * The surface channel experience (§6 as UI): hydration + spec reading +
 * bundle resolution mapped onto distinct rendered states, with the live
 * sandbox only ever receiving verified state and verified bytes.
 */
export const SurfacePostCollection: IPostCollectionView = forwardRef(
  function SurfacePostCollection() {
    const { channel } = usePostCollectionContext();
    return <SurfaceChannelView channel={channel} />;
  }
);

export function SurfaceChannelView({ channel }: { channel: db.Channel }) {
  const hydration = store.useSurfaceHydration({ channelId: channel.id });
  const hydrationState = hydration.data;

  // never fetch a bundle for a spec we won't run (future shell major)
  const spec =
    hydrationState?.status === 'hydrated' &&
    hydrationState.spec !== undefined &&
    hydrationState.spec.bundle.shellVersion <= shellArtifactVersion
      ? hydrationState.spec
      : undefined;
  const { phase, retry } = useSurfaceBundle(spec);

  const view = resolveSurfaceViewState({
    hydration: hydrationState,
    bundle: phase,
    shellVersion: shellArtifactVersion,
  });

  switch (view.kind) {
    case 'loading':
      return <SurfaceLoadingState />;
    case 'partial':
      return <SurfaceLoadingState partial />;
    case 'migration-pending':
      return <SurfaceMigrationPendingState />;
    case 'no-spec':
      return <SurfaceInvalidDefinitionState variant="absent" />;
    case 'invalid':
      return <SurfaceInvalidDefinitionState variant="invalid" />;
    case 'update-to-view':
      return <SurfaceUpdateToViewState reason={view.reason} />;
    case 'bundle-unavailable':
      return <SurfaceBundleUnavailableState onRetry={retry} />;
    case 'ready':
      return (
        <YStack flex={1}>
          {view.stateFull && <SurfaceDashboardFullBanner />}
          <SurfaceSandboxContainer
            channel={channel}
            spec={view.spec}
            state={view.state}
            bundleSource={view.bundleSource}
          />
        </YStack>
      );
  }
}
