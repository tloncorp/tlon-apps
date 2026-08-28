import type { JsonObject, SurfaceSpec } from '@tloncorp/api';
import type * as db from '@tloncorp/shared/db';
// eslint-disable-next-line
// @ts-ignore generated at build time by `pnpm build:surface-shell`
import {
  shellArtifactCss,
  shellArtifactJs,
} from '@tloncorp/surface-shell/artifact-strings';
import { buildSandboxDocument } from '@tloncorp/surface-shell/sandbox';
import * as store from '@tloncorp/shared';
import { useCallback, useMemo } from 'react';
import { useThemeName } from 'tamagui';

import { useCurrentUserId } from '../../contexts/appDataContext';
import { useCanWrite } from '../../utils/channelUtils';
import { SurfaceSandboxHost } from './SurfaceSandboxHost';
import { sandboxSessionKey } from './sandboxSession';
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
    /**
     * The key is the whole fix for "an admin edits the spec and the
     * dashboard quietly stops working": the sandbox document is memoized
     * on the bundle bytes, so a revision bump that keeps the same bundle
     * leaves `srcDoc` byte-identical and the frame never reloads on its
     * own. Without a remount the host would tear down the ready session
     * and build a replacement that never receives a `ready`, so state
     * updates stop arriving and invokes are dropped until the screen is
     * remounted by hand.
     *
     * Note what this deliberately is NOT: reassigning `srcDoc` on the
     * live element. That would reload the same frame, which is
     * indistinguishable from the frame navigating itself — exactly the
     * signal the host's teardown watches for. Changing the key produces a
     * NEW element instead, whose first load is its own initial load, so
     * an intentional session replacement can never be read as hostile
     * navigation.
     */
    <SurfaceSandboxHost
      key={sandboxSessionKey(spec)}
      document={sandboxDocument}
      spec={spec}
      state={state}
      theme={theme}
      canInvoke={canInvoke}
      onInvoke={sendInvoke}
    />
  );
}
