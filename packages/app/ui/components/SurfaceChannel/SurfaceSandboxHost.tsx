import type { JsonObject, SurfaceSpec } from '@tloncorp/api';
import { useEffect, useRef } from 'react';

import { SURFACE_SANDBOX_IFRAME_FLAGS } from './sandboxDocument';
import {
  SandboxSession,
  ShellTheme,
  createSandboxSession,
} from './sandboxSession';

export interface SurfaceSandboxHostProps {
  /** the fully assembled sandbox document (CSP meta + shell + bundle) */
  document: string;
  spec: SurfaceSpec;
  state: JsonObject;
  theme: ShellTheme;
  canInvoke: boolean;
  onInvoke: (actionId: string) => void;
  onShellError?: (phase: string, message: string) => void;
}

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
 *   deliverable. That is safe here because the sandboxed frame cannot
 *   navigate anywhere, inbound is `event.source`-checked against this
 *   exact frame, and the payload contains only what the sandbox is
 *   entitled to see anyway (its own spec, state, theme, permission).
 * - EVERY inbound message goes through the canonical strict schemas in
 *   the shared session before anything acts on it.
 */
export function SurfaceSandboxHost(props: SurfaceSandboxHostProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const sessionRef = useRef<SandboxSession | null>(null);

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

  const { document: sandboxDocument, spec } = props;
  useEffect(() => {
    const iframe = iframeRef.current;
    if (iframe == null) {
      return;
    }
    const session = createSandboxSession({
      spec,
      initialState: latest.current.state,
      theme: latest.current.theme,
      canInvoke: latest.current.canInvoke,
      post: (serialized) => {
        iframe.contentWindow?.postMessage(serialized, '*');
      },
      onInvoke: (actionId) => latest.current.onInvoke(actionId),
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
  }, [sandboxDocument, spec]);

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

  return (
    <iframe
      ref={iframeRef}
      title="Surface app"
      sandbox={SURFACE_SANDBOX_IFRAME_FLAGS}
      srcDoc={sandboxDocument}
      style={{ flex: 1, width: '100%', height: '100%', border: 0 }}
    />
  );
}
