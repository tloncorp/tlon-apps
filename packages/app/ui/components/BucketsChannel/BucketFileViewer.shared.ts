export type BucketPreviewKind =
  | 'image'
  | 'video'
  | 'text'
  | 'html'
  | 'pdf'
  | 'unsupported';

export type BucketFileViewerItem = {
  name: string;
  mimeType?: string;
  size?: number;
  sizeLabel?: string;
  uri?: string;
  textContent?: string;
};

/**
 * Largest object we will read into memory to preview as text.
 *
 * A text preview is `response.text()`, so the whole object becomes a JS
 * string — at roughly twice its byte size in UTF-16, before rendering it.
 * The backend accepts objects up to 5 GiB and a file counts as text on its
 * extension alone, so a log or a database dump named `.csv` is an ordinary
 * thing to find in a Bucket and an unbounded read of one takes the client
 * down. Two megabytes is already tens of thousands of lines, well past what
 * anyone reads in a preview pane.
 */
export const MAX_TEXT_PREVIEW_BYTES = 2 * 1024 * 1024;

/**
 * Whether this file's preview is built from its text -- a plain-text file
 * shown as is, or an HTML file rendered as a document -- or is only too large
 * to be. Both kinds read the whole object into a string, so both are gated on
 * the cap above.
 *
 * Refused rather than truncated: a partial JSON or CSV looks like a whole
 * one, and a preview that silently lies is worse than one that declines.
 */
export function canPreviewFromText(
  item: Pick<BucketFileViewerItem, 'mimeType' | 'name' | 'size'>
): boolean {
  const kind = getBucketPreviewKind(item);
  if (kind !== 'text' && kind !== 'html') return false;
  return item.size === undefined || item.size <= MAX_TEXT_PREVIEW_BYTES;
}

export function getBucketPreviewKind({
  mimeType,
  name,
}: Pick<BucketFileViewerItem, 'mimeType' | 'name'>): BucketPreviewKind {
  // Without parameters: an upload can arrive as `text/html; charset=utf-8`.
  const normalizedMimeType = mimeType?.split(';')[0].trim().toLowerCase() ?? '';
  const extension = name.split('.').pop()?.toLowerCase();

  if (normalizedMimeType.startsWith('image/')) {
    return 'image';
  }
  if (normalizedMimeType.startsWith('video/')) {
    return 'video';
  }
  // Before the text check: text/html is text too, but it is shown rendered,
  // not as source.
  if (
    normalizedMimeType === 'text/html' ||
    ['html', 'htm'].includes(extension ?? '')
  ) {
    return 'html';
  }
  if (
    normalizedMimeType.startsWith('text/') ||
    ['md', 'markdown', 'txt', 'json', 'csv'].includes(extension ?? '')
  ) {
    return 'text';
  }
  if (normalizedMimeType === 'application/pdf' || extension === 'pdf') {
    return 'pdf';
  }

  return 'unsupported';
}

/**
 * The sandbox for the frame that renders an HTML file on web.
 *
 * The document is a stranger's: anyone who can write to the Bucket wrote it.
 * It is loaded through `srcdoc`, and an unsandboxed srcdoc document inherits
 * the app's origin -- the file's scripts would run as the app, with its
 * cookies, its database and its ship session. So `allow-same-origin` is never
 * granted: the document gets an opaque origin, and its scripts run inside
 * that, with HTML_PREVIEW_POLICY keeping them off the network. Forms stay
 * forbidden. Popups are allowed so that a link in the document opens in a
 * new tab, and escape the sandbox so that what opens is an ordinary page.
 *
 * Under Electron scripts are withheld. The desktop shell starts its window
 * with `webSecurity: false` (apps/tlon-desktop/src/main/index.ts), which
 * grants every document in it universal access, so there the opaque origin
 * would not keep a script in the file out of the app's window. Until the
 * shell can isolate the frame, the file renders there without its scripts.
 */
export function htmlPreviewSandbox({
  isElectron,
}: {
  isElectron: boolean;
}): string {
  return [
    ...(isElectron ? [] : ['allow-scripts']),
    'allow-popups',
    'allow-popups-to-escape-sandbox',
  ].join(' ');
}

/** The sandbox for the frame that holds an HTML file on native: scripts, and nothing else. */
export const HTML_PREVIEW_NATIVE_SANDBOX = 'allow-scripts';

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * The document the viewer loads: a shell of ours, with the file in a
 * sandboxed frame inside it.
 *
 * Two things only a parent document can provide. A sandboxed frame may
 * still navigate itself -- a script setting `location`, a meta refresh --
 * which would replace the file with a remote page and shed the policy placed
 * into it; the shell's `frame-src about:` lets the inline frame load and
 * refuses every destination it could be sent to. And a frame without
 * `allow-modals` cannot show `alert`, `confirm` or `prompt`, which on native
 * would otherwise surface as the app's own dialogs, as often as a hostile
 * script liked. The shell carries no script of its own, and nothing of the
 * file's outside the escaped attribute.
 */
export function htmlPreviewShell({
  document,
  sandbox,
}: {
  document: string;
  sandbox: string;
}): string {
  return (
    '<!doctype html><html><head><meta charset="utf-8">' +
    '<meta http-equiv="Content-Security-Policy" content="frame-src about:">' +
    '<style>html,body{margin:0;height:100%;background:#fff}iframe{display:block;border:0;width:100%;height:100%}</style>' +
    `</head><body><iframe sandbox="${sandbox}" srcdoc="${escapeAttribute(document)}"></iframe></body></html>`
  );
}

/**
 * The policy every HTML preview carries, placed into the document itself.
 *
 * On web the frame sits on the ship's own page, and browsers differ on
 * whether a request from a sandboxed frame there still carries the reader's
 * session cookie (Chromium withholds a Lax cookie; WebKit keys first-party
 * cookies on the top-level page). On Android every WebView shares the cookie
 * jar React Native's own networking keeps the ship session in. Either way a
 * script in the file could have called the reader's ship as them, so the
 * document may open no connection: not by fetch, not by a socket, not by a
 * beacon. Its forms cannot submit (Android never reports a POST navigation
 * to the load handler), and no frame or object may load inside it, since one
 * would carry a policy of its own. What it may still do is render: load its
 * images, styles and fonts, and run its scripts against its own DOM.
 */
export const HTML_PREVIEW_POLICY =
  "<meta http-equiv=\"Content-Security-Policy\" content=\"connect-src 'none'; form-action 'none'; frame-src 'none'; object-src 'none'\">";

/**
 * The file's markup with `fragment` placed where the parser sees it before
 * any of the file's own content: after the doctype, and after any comments
 * ahead of it, so that the document keeps standards mode; first when there is
 * no doctype, which is a document in quirks mode already.
 */
function withDocumentHead(html: string, fragment: string): string {
  const lead = html.match(/^(?:\s+|<!--[\s\S]*?-->)*<!doctype[^>]*>/i);
  if (!lead) return fragment + html;
  return html.slice(0, lead[0].length) + fragment + html.slice(lead[0].length);
}

/**
 * The file's markup as the web frame loads it: the policy, and `_blank` as
 * the default link target.
 *
 * A link would otherwise navigate the frame itself -- the sandbox has no
 * token that forbids that, and a destination that refuses framing leaves the
 * preview blank -- whereas with popups allowed to escape the sandbox it opens
 * as an ordinary page in a new tab and the preview stays put. The first
 * `<base>` with a target wins, so a `<base href>` of the file's own still
 * applies. Native does not get the target: there a `_blank` link comes back
 * as a navigation with no tap on record, which htmlPreviewNavigation refuses.
 */
export function htmlPreviewWebDocument(html: string): string {
  return withDocumentHead(html, `${HTML_PREVIEW_POLICY}<base target="_blank">`);
}

/**
 * The file's markup as the native WebView loads it: the policy alone. iOS
 * holds no cookies in that WebView and would need none of it, but gets the
 * same document for the same behavior.
 */
export function htmlPreviewNativeDocument(html: string): string {
  return withDocumentHead(html, HTML_PREVIEW_POLICY);
}

export type HtmlPreviewNavigation = 'load' | 'open-externally' | 'block';

/**
 * What the native preview does with a navigation its WebView reports, for
 * the shell and the frame inside it alike. The inline documents load. A web
 * link the reader taps goes to the system browser: the preview keeps showing
 * the file, and the destination gets a real address bar. Everything else --
 * a meta refresh, a form, a redirect, any scheme that is not a web link --
 * is refused, so a document cannot bounce the reader into another app or
 * show them a page that is not the file.
 *
 * iOS reports the gesture. Android does not (the library sends no real
 * `navigationType`), so there a link is inert rather than a script's
 * navigation being mistaken for a tap.
 */
export function htmlPreviewNavigation({
  navigationType,
  url,
}: {
  navigationType?: string;
  url: string;
}): HtmlPreviewNavigation {
  if (url.startsWith('about:')) return 'load';
  if (navigationType === 'click' && /^(https?|mailto|tel):/i.test(url)) {
    return 'open-externally';
  }
  return 'block';
}
