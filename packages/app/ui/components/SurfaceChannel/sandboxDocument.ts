/**
 * Sandbox document assembly (plan §5): the host owns the whole document —
 * the CSP arrives via a host-injected meta tag (a srcdoc/`source={{html}}`
 * document has no headers of its own to trust), the shell loads first
 * (D31), and the bundle is a plain script after it. Pure and
 * dependency-free so the browser-level sandbox-posture test can import it
 * directly.
 */

/**
 * `default-src 'none'` shape: every fetch/XHR/WebSocket/image/font/media/
 * frame request is denied; only the inline script and style the host
 * itself injects may run. No network can originate inside the sandbox.
 */
export const SURFACE_SANDBOX_CSP =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'";

/**
 * Iframe sandbox flags: scripts only. No allow-same-origin (the document
 * gets an opaque origin), no forms, no popups, no downloads, no modals,
 * no top-navigation.
 */
export const SURFACE_SANDBOX_IFRAME_FLAGS = 'allow-scripts';

/**
 * A `</script` inside either source would terminate the wrapping script
 * element and let document text escape into markup. Inside JS strings
 * `<\/` is identical to `</`, so this rewrite is semantics-preserving for
 * the embedded code while making the sequence inert in HTML.
 */
export function escapeInlineScript(source: string): string {
  return source.replace(/<\/script/gi, '<\\/script');
}

export function buildSandboxDocument(options: {
  shellJs: string;
  shellCss: string;
  bundleSource: string;
}): string {
  return [
    '<!doctype html>',
    '<html>',
    '<head>',
    '<meta charset="utf-8" />',
    `<meta http-equiv="Content-Security-Policy" content="${SURFACE_SANDBOX_CSP}" />`,
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    `<style>${options.shellCss}</style>`,
    '</head>',
    '<body>',
    `<script>${escapeInlineScript(options.shellJs)}</script>`,
    `<script>${escapeInlineScript(options.bundleSource)}</script>`,
    '</body>',
    '</html>',
  ].join('\n');
}
