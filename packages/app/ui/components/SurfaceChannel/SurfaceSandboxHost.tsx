// the /debug subpath keeps this module off the shared barrel, which drags
// expo-modules-core into node tests
import { createDevLogger } from '@tloncorp/shared/debug';
import { SURFACE_SANDBOX_IFRAME_FLAGS } from '@tloncorp/surface-shell/sandbox';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  SandboxSession,
  type SurfaceSandboxHostProps,
  createSandboxSession,
} from './sandboxSession';

export type { SurfaceSandboxHostProps };

const logger = createDevLogger('surfaceSandboxHost', false);

/**
 * Web sandbox host: a sandboxed srcdoc iframe running the shell artifact
 * and the verified bundle.
 *
 * Posture (recorded per the session prompt):
 * - `sandbox="allow-scripts"` only — no same-origin (the document gets an
 *   OPAQUE origin), no forms/popups/downloads/modals/top-navigation.
 * - The host-injected CSP meta inside the document is the network gate
 *   (`default-src 'none'`); the document has no headers of its own.
 * - Outbound postMessage uses targetOrigin `'*'` by necessity: an opaque
 *   origin matches no concrete targetOrigin string, so nothing else is
 *   deliverable. That is safe here because inbound is `event.source`-
 *   checked against this exact frame and the payload contains only what
 *   the sandbox is entitled to see anyway (its own spec, state, theme,
 *   permission).
 * - EVERY inbound message goes through the canonical strict schemas in
 *   the shared session before anything acts on it.
 *
 * The frame CAN still navigate itself (D43, and the in-realm caveats in
 * `@tloncorp/surface-shell/sandbox`); the teardown below bounds what that buys an
 * attacker without pretending to prevent it.
 *
 * This component is mounted under a `sandboxSessionKey(spec)` React key,
 * so a bundle or spec-revision change destroys this instance and mounts a
 * fresh one. Every mutable thing here (the session, the loaded-frame
 * marker, the late-bound props) is per-instance, so the new sandbox
 * shares nothing with the old one.
 */
export function SurfaceSandboxHost(props: SurfaceSandboxHostProps) {
  const { document: sandboxDocument, spec } = props;
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const sessionRef = useRef<SandboxSession | null>(null);
  const [navigatedAway, setNavigatedAway] = useState(false);

  /**
   * The element whose initial srcdoc load has already been seen.
   *
   * "Initial" is a property of the ELEMENT, not of this component and not
   * of the clock: the first load of a given iframe node is the document
   * the host wrote into `srcDoc`, and a second load of that SAME node is
   * a document the host did not write — i.e. the frame navigated itself.
   * An intentional session replacement (a spec revision, via this
   * component's React key) is a DIFFERENT node whose first load is its
   * own initial load, so it can never be read as navigation, and it is
   * armed the same way from that point on.
   *
   * The premise — that the host's iframe fires exactly ONE load for its
   * srcdoc document — is measured on all three engines in
   * `apps/tlon-web/sandbox-posture/navigation.spec.ts`. It holds because
   * React sets `srcDoc` before inserting the element; assigning `srcdoc`
   * to an element already in the document produces an extra
   * `about:blank` load on chromium and webkit, which is a second reason
   * a revision change must never be an in-place `srcDoc` reassignment.
   */
  const loadedFrameRef = useRef<HTMLIFrameElement | null>(null);

  /**
   * Tear the frame down on any post-initial load.
   *
   * This does NOT stop the exfiltration: the request that carried the
   * payload in its URL has already left the device by the time a load
   * fires (and if it was refused pre-flight there is no load event at
   * all). What it buys is bounding the second stage — attacker-served
   * code stops running in the frame promptly instead of living as long
   * as the screen is open — and closing a disclosure path that would
   * otherwise be worse than the navigation itself: a navigated frame can
   * still post `ready`, `event.source` still matches the same element,
   * and the session would answer it with a full `init` (spec + state)
   * for a document we did not write.
   */
  const handleLoad = useCallback(
    (event: { currentTarget: HTMLIFrameElement }) => {
      const node = event.currentTarget;
      if (loadedFrameRef.current !== node) {
        loadedFrameRef.current = node;
        return;
      }
      logger.trackError(
        'surface sandbox frame navigated itself; tearing down',
        {
          surfaceId: spec.surfaceId,
          specRevision: spec.specRevision,
        }
      );
      setNavigatedAway(true);
    },
    [spec.surfaceId, spec.specRevision]
  );

  // late-bound handlers/values so the session effect only re-runs when
  // the document or spec actually changes (an iframe reload)
  const latest = useRef({
    state: props.state,
    theme: props.theme,
    canInvoke: props.canInvoke,
    onInvoke: props.onInvoke,
    onShellError: props.onShellError,
  });
  latest.current.onInvoke = props.onInvoke;
  latest.current.onShellError = props.onShellError;

  useEffect(() => {
    const iframe = iframeRef.current;
    if (iframe == null || navigatedAway) {
      return;
    }
    /**
     * Bound ONCE, to this session. `onInvoke` stamps the outgoing action
     * with its own spec revision, and this session validates incoming
     * invokes against the spec it was constructed with, so the two must
     * be the same revision. Reading `latest.current.onInvoke` at call
     * time instead would let an invoke validated against revision N be
     * stamped by a writer already re-pointed at N+1 — the render-phase
     * write above lands before the old listener is torn down.
     *
     * That mis-stamp is not cosmetic: the reducer folds a stale invoke
     * only when the CURRENT action opts in via `acceptStale`, but an
     * invoke wearing the current revision folds unconditionally. So an
     * action the user took under revision N would execute under N+1's
     * meaning with the staleness gate bypassed entirely.
     */
    const boundOnInvoke = latest.current.onInvoke;
    const session = createSandboxSession({
      spec,
      initialState: latest.current.state,
      theme: latest.current.theme,
      canInvoke: latest.current.canInvoke,
      post: (serialized) => {
        iframe.contentWindow?.postMessage(serialized, '*');
      },
      onInvoke: (actionId) => boundOnInvoke(actionId),
      onShellError: (phase, message) =>
        latest.current.onShellError?.(phase, message),
    });
    sessionRef.current = session;
    const listener = (event: MessageEvent) => {
      // only messages from OUR frame are ever considered
      if (event.source !== iframe.contentWindow) {
        return;
      }
      session.handleInbound(event.data);
    };
    window.addEventListener('message', listener);
    return () => {
      window.removeEventListener('message', listener);
      sessionRef.current = null;
    };
  }, [sandboxDocument, spec, navigatedAway]);

  useEffect(() => {
    latest.current.state = props.state;
    sessionRef.current?.updateState(props.state);
  }, [props.state]);
  useEffect(() => {
    latest.current.theme = props.theme;
    sessionRef.current?.updateTheme(props.theme);
  }, [props.theme]);
  useEffect(() => {
    latest.current.canInvoke = props.canInvoke;
    sessionRef.current?.updatePermission(props.canInvoke);
  }, [props.canInvoke]);

  if (navigatedAway) {
    // unmounting the element destroys the browsing context, which is the
    // only teardown that actually stops the code running inside it
    return null;
  }

  return (
    <iframe
      ref={iframeRef}
      title="Surface app"
      sandbox={SURFACE_SANDBOX_IFRAME_FLAGS}
      srcDoc={sandboxDocument}
      onLoad={handleLoad}
      style={{ flex: 1, width: '100%', height: '100%', border: 0 }}
    />
  );
}
