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
 * granted: the document gets an opaque origin.
 *
 * Scripts and forms are withheld as well. The frame sits on the ship's own
 * page, and browsers differ on whether a request from a sandboxed frame there
 * still carries the reader's session cookie: Chromium withholds a Lax cookie,
 * WebKit keys first-party cookies on the top-level page. A script in the file
 * could therefore call the reader's ship as them, and a form could post to
 * it. Only popups are allowed, so that a link in the document opens in a new
 * tab, and they escape the sandbox so that what opens is an ordinary page.
 */
export const HTML_PREVIEW_SANDBOX =
  'allow-popups allow-popups-to-escape-sandbox';

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
 * The file's markup as the web frame loads it.
 *
 * A link in the file would otherwise navigate the frame itself: the sandbox
 * has no token that forbids that, and a destination that refuses framing
 * leaves the preview blank. With `_blank` as the default target, and popups
 * allowed to escape the sandbox, a link opens as an ordinary page in a new
 * tab and the preview stays put. The first `<base>` with a target wins, so a
 * `<base href>` of the file's own still applies. Native does not get this:
 * there a `_blank` link comes back as a navigation with no tap on record,
 * which htmlPreviewNavigation refuses.
 */
export function htmlPreviewWebDocument(html: string): string {
  return withDocumentHead(html, '<base target="_blank">');
}

/**
 * The file's markup as the native WebView loads it: with a policy that keeps
 * the document from submitting forms or opening connections.
 *
 * On Android every WebView shares the cookie jar React Native's own networking
 * keeps the ship session in, and the platform never reports a POST navigation
 * to `onShouldStartLoadWithRequest`, so a form the reader tapped would reach
 * the ship as them. iOS holds no cookies in this WebView and needs none of
 * it, but gets the same document for the same behavior.
 */
export function htmlPreviewNativeDocument(html: string): string {
  return withDocumentHead(
    html,
    '<meta http-equiv="Content-Security-Policy" content="form-action \'none\'; connect-src \'none\'">'
  );
}

export type HtmlPreviewNavigation = 'load' | 'open-externally' | 'block';

/**
 * What the native HTML preview does with a navigation its WebView reports.
 *
 * The document is handed to the WebView as a string with no base URL, so it
 * loads as `about:blank`, and frames inside it may load what they like. A
 * link the reader taps in the top frame goes to the system browser: the
 * preview keeps showing the file, and the destination gets a real address
 * bar. Everything else the top frame tries -- a meta refresh, a form, a
 * redirect, any scheme that is not a web link -- is refused, so a document
 * cannot bounce the reader into another app without a tap.
 *
 * iOS reports the frame and the gesture. Android reports neither (the library
 * sends no `isTopFrame` and no real `navigationType`), so there every
 * navigation but the document's own is refused: a link is inert rather than
 * a frame being mistaken for a tap.
 */
export function htmlPreviewNavigation({
  isTopFrame,
  navigationType,
  url,
}: {
  isTopFrame?: boolean;
  navigationType?: string;
  url: string;
}): HtmlPreviewNavigation {
  if (url.startsWith('about:')) return 'load';
  if (isTopFrame === false) return 'load';
  if (navigationType === 'click' && /^(https?|mailto|tel):/i.test(url)) {
    return 'open-externally';
  }
  return 'block';
}
