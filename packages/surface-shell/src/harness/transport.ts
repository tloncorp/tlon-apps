import { ShellToHostMessage } from '../protocol/types';

/**
 * The shell's postMessage seam. Only two operations exist — post one of
 * the protocol's shell→host messages, and subscribe to raw inbound data —
 * so tests can stub the host and the real sandbox environments (iframe,
 * RN webview) plug in without the harness knowing which it is in.
 */
export interface BridgeTransport {
  post(message: ShellToHostMessage): void;
  onMessage(listener: (data: unknown) => void): void;
}

type SandboxWindow = Window & {
  ReactNativeWebView?: { postMessage(data: string): void };
};

/**
 * Default transport for the two real sandbox worlds: an RN WebView
 * (ReactNativeWebView.postMessage, string payloads) or a sandboxed iframe
 * (parent.postMessage). Inbound messages arrive as window 'message' events
 * in both. Hosts may deliver either structured data or JSON strings; both
 * are surfaced to the listener already parsed.
 */
export function detectTransport(win: Window): BridgeTransport {
  const sandboxWindow = win as SandboxWindow;
  return {
    post(message) {
      if (sandboxWindow.ReactNativeWebView) {
        sandboxWindow.ReactNativeWebView.postMessage(JSON.stringify(message));
        return;
      }
      // The host wrapper owns the embedding, so origin scoping is its
      // side of the contract; the sandbox has no origin of its own in a
      // srcdoc world.
      win.parent?.postMessage(JSON.stringify(message), '*');
    },
    onMessage(listener) {
      win.addEventListener('message', (event: MessageEvent) => {
        let data: unknown = event.data;
        if (typeof data === 'string') {
          try {
            data = JSON.parse(data);
          } catch {
            return; // not protocol traffic
          }
        }
        listener(data);
      });
    },
  };
}
