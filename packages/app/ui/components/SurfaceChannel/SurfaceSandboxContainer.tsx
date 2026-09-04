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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useThemeName } from 'tamagui';

import { useCurrentUserId } from '../../contexts/appDataContext';
import { useCanWrite } from '../../utils/channelUtils';
import { SurfaceSandboxHost } from './SurfaceSandboxHost';
import { SurfaceHaltedState } from './SurfaceStates';
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

  const now = useHostClock(spec.timeDisplay?.refreshSeconds ?? null);

  /**
   * A bundle that failed before it registered leaves an iframe that handshook
   * and then drew nothing. The shell reports it as an `init` error (it
   * installs a window error handler for exactly this), and without somewhere
   * to put that report the board stayed blank forever — no message, no
   * telemetry, and an `onShellError` channel plumbed through the whole
   * session layer to a UI that did not exist.
   *
   * `reloadNonce` bumps the session key rather than reassigning `srcDoc`, for
   * the reason spelled out at the render below: a reload of the same element
   * is indistinguishable from the frame navigating itself, which the host
   * tears down as hostile.
   */
  const [halted, setHalted] = useState<{
    session: string;
    detail: string;
  } | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  /**
   * The session this render would mount: the spec's own session identity
   * plus the reload counter. Both halves matter — a new revision is a new
   * session because the running sandbox has never seen that spec, and a
   * reload is a new session because a reused element's second load reads as
   * the frame navigating itself.
   */
  const sessionKey = `${sandboxSessionKey(spec)}:${reloadNonce}`;

  /**
   * A halt belongs to the SESSION that failed, not to the component (D194).
   *
   * It used to be a bare message, and the early return below sat above the
   * keyed host — so a board halted on revision 1 could not mount revision 2.
   * An admin publishing the fix changed nothing for anyone already looking at
   * the broken board: every mounted viewer stayed on revision 1's error until
   * they pressed Reload or navigated away, which is precisely the population
   * that cannot be told to do either. Keying the halt means a healthy
   * revision arrives as a different session and clears it by not matching.
   */
  const sessionKeyRef = useRef(sessionKey);
  useEffect(() => {
    sessionKeyRef.current = sessionKey;
  }, [sessionKey]);

  const handleShellError = useCallback((phase: string, message: string) => {
    // `render` errors already have a defined presentation: the shell swaps in
    // its own broken-state view inside the frame and the app keeps running.
    // Only a failure to initialize leaves nothing on screen.
    if (phase === 'init') {
      setHalted({ session: sessionKeyRef.current, detail: message });
    }
  }, []);

  // No `setHalted(null)` here: bumping the nonce is what makes the next
  // render a different session, and a halt that names a session nobody is
  // mounting is already not shown. Clearing it separately would be a second
  // representation of the same fact, free to disagree with the first.
  const reloadSurface = useCallback(() => {
    setReloadNonce((nonce) => nonce + 1);
  }, []);

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

  if (halted !== null && halted.session === sessionKey) {
    return (
      <SurfaceHaltedState detail={halted.detail} onReload={reloadSurface} />
    );
  }

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
      key={sessionKey}
      document={sandboxDocument}
      spec={spec}
      state={state}
      theme={theme}
      canInvoke={canInvoke}
      now={now}
      onInvoke={sendInvoke}
      onShellError={handleShellError}
    />
  );
}

/**
 * The host's clock, and the ONLY clock a surface app ever sees.
 *
 * The shell reads no time of its own: it holds whatever `now` the host last
 * sent and hands it to `render` as a display input. So the cadence question —
 * does this screen need to keep moving? — is answered HERE, from the spec's
 * `timeDisplay` declaration, and not by a timer the sandbox started for
 * itself.
 *
 * `refreshSeconds` null means the spec declares nothing, so this returns one
 * fixed reading taken at mount and never ticks. That is the right default and
 * not a degraded one: a screen derived from state alone is correct forever,
 * and repainting it on a timer would burn a wakeup per minute per open
 * channel to produce identical pixels.
 *
 * Why the declaration gates the timer rather than the app just asking: the
 * publish gate has to be able to SEE that this app's screen moves with the
 * clock (rule 16), because the twelve preview cells a reviewer scored are a
 * snapshot taken at one fixed `now`. An app that ticks without declaring it is
 * an app whose scoring sheet is about a screen nobody will see.
 */
function useHostClock(refreshSeconds: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (refreshSeconds === null) {
      return;
    }
    // Re-read at mount too: a screen that has been backgrounded for an hour
    // is showing an hour-old clock, and the declaration says that matters.
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), refreshSeconds * 1000);
    return () => clearInterval(timer);
  }, [refreshSeconds]);
  return now;
}
