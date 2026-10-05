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
 * A text preview reads the whole object into a JS string — at roughly twice
 * its byte size in UTF-16, before rendering it. The backend accepts objects
 * up to 5 GiB and a file counts as text on its extension alone, so a log or
 * a database dump named `.csv` is an ordinary thing to find in a Bucket and
 * an unbounded read of one takes the client down. Two megabytes is already
 * tens of thousands of lines, well past what anyone reads in a preview pane.
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

/**
 * The text of a preview response, or null when the object is over the cap.
 *
 * The manifest size that canPreviewFromText checks is the writer's own
 * word, recorded at upload; the object behind the read URL can be anything.
 * So the response is bounded too: by its declared length first, and then,
 * where the platform streams the body, as the bytes arrive -- the read stops
 * at the first byte past the cap. React Native's fetch has no stream, so
 * there the whole body is read and the result refused if it is longer than
 * the cap could have allowed (a string's UTF-16 length never exceeds its
 * UTF-8 byte count).
 */
export async function readPreviewText(
  response: Response,
  limit = MAX_TEXT_PREVIEW_BYTES
): Promise<string | null> {
  const declared = Number(response.headers.get('content-length'));
  if (declared > limit) return null;

  const body = response.body;
  if (!body || typeof body.getReader !== 'function') {
    const text = await response.text();
    return text.length > limit ? null : text;
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > limit) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
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

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  nbsp: ' ',
  quot: '"',
};

function decodeEntities(text: string): string {
  return text.replace(
    /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
    (entity: string, body: string) => {
      if (body[0] !== '#') {
        return NAMED_ENTITIES[body.toLowerCase()] ?? entity;
      }
      const code =
        body[1]?.toLowerCase() === 'x'
          ? parseInt(body.slice(2), 16)
          : parseInt(body.slice(1), 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
    }
  );
}

/**
 * The title of an HTML file, as the page itself would show it: the first
 * `<title>` outside any `<svg>` (an SVG title is a tooltip, not the
 * document's), with entities decoded and whitespace collapsed, the way
 * `document.title` reads it. Undefined when the file has none or it is blank.
 */
export function htmlPreviewTitle(html: string): string | undefined {
  const markup = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<svg[\s>][\s\S]*?<\/svg\s*>/gi, '');
  const match = markup.match(/<title(?:\s[^>]*)?>([\s\S]*?)<\/title\s*>/i);
  if (!match) return undefined;
  const title = decodeEntities(match[1]).replace(/\s+/g, ' ').trim();
  return title === '' ? undefined : title.slice(0, 200);
}

/**
 * What the viewer's header says about a file. A rendered HTML page is named
 * by its own title, with the file's name and size beneath it; anything else
 * by its file name, with its size.
 */
export function bucketFileViewerHeading(item: BucketFileViewerItem): {
  subtitle: string;
  title: string;
} {
  const pageTitle =
    getBucketPreviewKind(item) === 'html' && item.textContent !== undefined
      ? htmlPreviewTitle(item.textContent)
      : undefined;
  if (pageTitle === undefined) {
    return { subtitle: item.sizeLabel ?? 'File', title: item.name };
  }
  return {
    subtitle: item.sizeLabel ? `${item.name} · ${item.sizeLabel}` : item.name,
    title: pageTitle,
  };
}

/**
 * The sandbox for the frames that render an HTML file on web: the shell's,
 * and the file's own inside it.
 *
 * The document is a stranger's: anyone who can write to the Bucket wrote it.
 * It is loaded through `srcdoc`, and an unsandboxed srcdoc document inherits
 * the app's origin -- the file's scripts would run as the app, with its
 * cookies, its database and its ship session. So `allow-same-origin` is never
 * granted: the document gets an opaque origin, and its scripts run inside
 * that, with HTML_PREVIEW_POLICY keeping them off the network. Nothing else
 * is granted. Without `allow-popups` the document cannot open a window --
 * which it could otherwise do with no click at all, as many times as it
 * liked, each one a top-level page of its choosing dressed as whatever it
 * pleased -- so a link in the file is inert, on web as on native.
 *
 * Under Electron scripts are withheld too. The desktop shell starts its
 * window with `webSecurity: false` (apps/tlon-desktop/src/main/index.ts),
 * which grants every document in it universal access, so there the opaque
 * origin would not keep a script in the file out of the app's window. Until
 * the shell can isolate the frame, the file renders there without its
 * scripts.
 */
export function htmlPreviewSandbox({
  isElectron,
}: {
  isElectron: boolean;
}): string {
  return isElectron ? '' : 'allow-scripts';
}

/** The sandbox for the frame that holds an HTML file on native: scripts, and nothing else. */
export const HTML_PREVIEW_NATIVE_SANDBOX = 'allow-scripts';

/**
 * The policy every HTML preview runs under.
 *
 * On web the frame sits on the ship's own page, and browsers differ on
 * whether a request from a sandboxed frame there still carries the reader's
 * session cookie (Chromium withholds a Lax cookie; WebKit keys first-party
 * cookies on the top-level page). On Android every WebView shares the cookie
 * jar React Native's own networking keeps the ship session in. Either way a
 * script in the file could have called the reader's ship as them, so the
 * document may open no connection: not by fetch, not by a socket, not by a
 * beacon. Its forms cannot submit (Android never reports a POST navigation
 * to the load handler), no object may load inside it, and the only frame it
 * may hold is an inline one, which inherits this same policy. What it may
 * still do is render: load its images, styles and fonts, and run its scripts
 * against its own DOM.
 *
 * The policy is delivered by the shell (htmlPreviewShell), whose markup the
 * file cannot reach: a document loaded through `srcdoc` inherits the policy
 * of the document that holds it, in Chromium and WebKit alike. It is placed
 * into the file's own markup as well (htmlPreviewDocument), so that it holds
 * even where that inheritance did not.
 */
export const HTML_PREVIEW_POLICY =
  "connect-src 'none'; form-action 'none'; frame-src about:; object-src 'none'";

const HTML_PREVIEW_POLICY_META = `<meta http-equiv="Content-Security-Policy" content="${HTML_PREVIEW_POLICY}">`;

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
 * Three things only a parent document can provide. A sandboxed frame may
 * still navigate itself -- a script setting `location`, a meta refresh --
 * which would replace the file with a remote page; the shell's `frame-src
 * about:` lets the inline frame load and refuses every destination it could
 * be sent to. The shell's policy is inherited by the file's document, so it
 * holds however the file's own markup is shaped. And a frame without
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
    HTML_PREVIEW_POLICY_META +
    '<style>html,body{margin:0;height:100%;background:#fff}iframe{display:block;border:0;width:100%;height:100%}</style>' +
    `</head><body><iframe sandbox="${sandbox}" srcdoc="${escapeAttribute(document)}"></iframe></body></html>`
  );
}

/**
 * The file's markup with `fragment` placed where the parser sees it before
 * any of the file's own content: after the doctype, and after any comments
 * or processing instructions ahead of it, so that the document keeps
 * standards mode; first when there is no doctype, which is a document in
 * quirks mode already.
 *
 * A `>` ends a DOCTYPE token in every state of the HTML tokenizer, quoted
 * identifiers included, so the first `>` is where the parser's doctype ends.
 */
function withDocumentHead(html: string, fragment: string): string {
  const lead = html.match(
    /^(?:\s+|<!--[\s\S]*?-->|<\?[^>]*>)*<!doctype[^>]*>/i
  );
  if (!lead) return fragment + html;
  return html.slice(0, lead[0].length) + fragment + html.slice(lead[0].length);
}

/**
 * The file's markup as the frame loads it: the policy, and `_blank` as the
 * default link target.
 *
 * With no popup permission a `_blank` link is refused outright and the
 * preview stays as it was, whereas a link aimed at the frame itself is
 * refused by the shell's `frame-src`, after which Chromium shows its own
 * blocked-page notice in the frame. The first `<base>` with a target wins,
 * so a `<base href>` of the file's own still applies.
 */
export function htmlPreviewDocument(html: string): string {
  return withDocumentHead(
    html,
    `${HTML_PREVIEW_POLICY_META}<base target="_blank">`
  );
}

export type HtmlPreviewNavigation = 'load' | 'block';

/**
 * What the native preview does with a navigation its WebView reports, for
 * the shell and the frame inside it alike. The inline documents load.
 * Everything else -- a link, a meta refresh, a form, a redirect, any other
 * scheme -- is refused, so a document cannot bounce the reader into another
 * app or show them a page that is not the file. A tapped link is refused
 * with the rest: WKWebView reports a link a script clicks for it as a tap,
 * so a tap on record would have let a page send the reader to the system
 * browser the moment it loaded.
 */
export function htmlPreviewNavigation({
  url,
}: {
  url: string;
}): HtmlPreviewNavigation {
  return url.startsWith('about:') ? 'load' : 'block';
}
