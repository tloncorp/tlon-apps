import type { JsonObject, SurfaceSpec } from '@tloncorp/api';
import type * as db from '@tloncorp/shared/db';
// eslint-disable-next-line
// @ts-ignore generated at build time by `pnpm build:surface-shell`
import {
  shellArtifactCss,
  shellArtifactJs,
} from '@tloncorp/surface-shell/artifact-strings';
import * as store from '@tloncorp/shared';
import { useCallback, useMemo } from 'react';
import { useThemeName } from 'tamagui';

import { useCurrentUserId } from '../../contexts/appDataContext';
import { useCanWrite } from '../../utils/channelUtils';
import { SurfaceSandboxHost } from './SurfaceSandboxHost';
import { buildSandboxDocument } from './sandboxDocument';
import { shellThemeFromThemeName } from './surfaceTheme';

/**
 * Bridges renderer state into the platform sandbox host: assembles the
 * sandbox document from the EMBEDDED shell artifact (the only shell
 * delivery path — never fetched) plus the hash-verified bundle, derives
 * permission from the channel's writer perms, maps the app theme to the
 * shell's light/dark, and wires validated invokes to the posting path.
 */
export function SurfaceSandboxContainer({
  channel,
  spec,
  state,
  bundleSource,
}: {
  channel: db.Channel;
  spec: SurfaceSpec;
  state: JsonObject;
  bundleSource: string;
}) {
  const currentUserId = useCurrentUserId();
  const canInvoke = useCanWrite(channel, currentUserId);
  const themeName = useThemeName();
  const theme = shellThemeFromThemeName(themeName);

  const sendInvoke = useCallback(
    (actionId: string) => {
      // success is observed via the refold, not this promise; the host has
      // already validated + revision-checked the invoke by the time it
      // reaches here, and the writer stamps its own specRevision from spec
      void store
        .sendSurfaceInvoke({ channelId: channel.id, spec, actionId })
        .catch(() => {
          // failures surface as the post never appearing; nothing to do here
        });
    },
    [channel.id, spec]
  );

  const sandboxDocument = useMemo(
    () =>
      buildSandboxDocument({
        shellJs: shellArtifactJs,
        shellCss: shellArtifactCss,
        bundleSource,
      }),
    [bundleSource]
  );

  return (
    <SurfaceSandboxHost
      document={sandboxDocument}
      spec={spec}
      state={state}
      theme={theme}
      canInvoke={canInvoke}
      onInvoke={sendInvoke}
    />
  );
}
