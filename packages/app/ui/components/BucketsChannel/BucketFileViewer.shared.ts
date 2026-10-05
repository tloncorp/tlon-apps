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
 * The encoding a preview's bytes are in, decided as a browser decides for a
 * page: a byte order mark first, then the charset the response declares,
 * then -- for HTML -- a `<meta>` charset in the first 1024 bytes, and UTF-8
 * when nothing says otherwise. `head` is the start of the bytes, one byte per
 * character. A prescan that names UTF-16 is read as UTF-8, as browsers do: an
 * ASCII `<meta>` cannot be found in a document that really is UTF-16.
 */
export function previewEncoding({
  contentType,
  head,
  html,
}: {
  contentType?: string | null;
  head: string;
  html: boolean;
}): string {
  if (head.startsWith('ï»¿')) return 'utf-8';
  if (head.startsWith('þÿ')) return 'utf-16be';
  if (head.startsWith('ÿþ')) return 'utf-16le';
  const declared = contentType?.match(/;\s*charset\s*=\s*"?([^";\s]+)/i)?.[1];
  if (declared) return declared.toLowerCase();
  if (html) {
    const meta = head
      .slice(0, 1024)
      .match(/<meta\b[^>]*?charset\s*=\s*["']?\s*([a-z0-9_:.+-]+)/i)?.[1]
      ?.toLowerCase();
    if (meta) return meta.startsWith('utf-16') ? 'utf-8' : meta;
  }
  return 'utf-8';
}

function latin1(bytes: Uint8Array): string {
  let text = '';
  for (let i = 0; i < bytes.length; i++) text += String.fromCharCode(bytes[i]);
  return text;
}

// The labels the Encoding Standard reads as windows-1252, ISO-8859-1 and
// US-ASCII among them.
const WINDOWS_1252_LABELS = new Set([
  'ansi_x3.4-1968',
  'ascii',
  'cp1252',
  'cp819',
  'csisolatin1',
  'ibm819',
  'iso-8859-1',
  'iso-ir-100',
  'iso8859-1',
  'iso88591',
  'iso_8859-1',
  'iso_8859-1:1987',
  'l1',
  'latin1',
  'us-ascii',
  'windows-1252',
  'x-cp1252',
]);

// windows-1252 bytes 0x80-0x9F; every other byte is its own code point.
const WINDOWS_1252_HIGH = [
  0x20ac, 0x81, 0x201a, 0x192, 0x201e, 0x2026, 0x2020, 0x2021, 0x2c6, 0x2030,
  0x160, 0x2039, 0x152, 0x8d, 0x17d, 0x8f, 0x90, 0x2018, 0x2019, 0x201c, 0x201d,
  0x2022, 0x2013, 0x2014, 0x2dc, 0x2122, 0x161, 0x203a, 0x153, 0x9d, 0x17e,
  0x178,
];

function decodeWindows1252(bytes: Uint8Array): string {
  let text = '';
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    text += String.fromCharCode(
      byte >= 0x80 && byte <= 0x9f ? WINDOWS_1252_HIGH[byte - 0x80] : byte
    );
  }
  return text;
}

/**
 * The bytes as text in `encoding`. Where the runtime's TextDecoder knows the
 * encoding, it decodes. Expo's, which React Native apps get, knows only
 * UTF-8, so windows-1252 -- the encoding of most legacy Western pages, and
 * what ISO-8859-1 means to a browser -- is decoded here instead. Any other
 * encoding it does not know is read as UTF-8.
 */
function decodeBytes(bytes: Uint8Array, encoding: string): string {
  try {
    return new TextDecoder(encoding).decode(bytes);
  } catch {
    if (WINDOWS_1252_LABELS.has(encoding)) return decodeWindows1252(bytes);
    return new TextDecoder('utf-8').decode(bytes);
  }
}

/**
 * The text of a preview response, decoded in the encoding the file is in, or
 * null when the object is over the cap.
 *
 * The manifest size that canPreviewFromText checks is the writer's own
 * word, recorded at upload; the object behind the read URL can be anything.
 * So the response is bounded too: by its declared length first, and then,
 * as the bytes arrive, the read stops at the first byte past the cap. A body
 * that does not stream cannot be stopped that way, so it is declined.
 *
 * The bytes are decoded only once their encoding is known (previewEncoding):
 * `Response.text()` decodes as UTF-8 whatever the file says, and a page saved
 * as windows-1252 would lose every accented letter.
 */
export async function readPreviewText(
  response: Response,
  {
    html = false,
    limit = MAX_TEXT_PREVIEW_BYTES,
  }: { html?: boolean; limit?: number } = {}
): Promise<string | null> {
  const declared = Number(response.headers.get('content-length'));
  if (declared > limit) return null;

  let bytes: Uint8Array;
  const body = response.body;
  if (body && typeof body.getReader === 'function') {
    const reader = body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > limit) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    bytes = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
  } else {
    // Nothing can stop such a read at the cap: a body that does not stream is
    // read whole, and a compressed one can grow past any declared length. So
    // the preview is declined instead. The runtimes the app ships on, browsers
    // and Expo's fetch, all stream.
    return null;
  }

  const encoding = previewEncoding({
    contentType: response.headers.get('content-type'),
    head: latin1(bytes.subarray(0, 1024)),
    html,
  });
  return decodeBytes(bytes, encoding);
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

// Elements whose content is not read as markup for the document's title: the
// raw-text and escapable raw-text elements, noscript (raw text with scripting
// on), plaintext, and template, svg and math, whose titles are not the
// document's.
const TITLE_SKIPPED_ELEMENTS = new Set([
  'iframe',
  'math',
  'noembed',
  'noframes',
  'noscript',
  'plaintext',
  'script',
  'style',
  'svg',
  'template',
  'textarea',
  'xmp',
]);

// HTML's ASCII whitespace: tab, line feed, form feed, carriage return, space.
function isHtmlSpace(code: number): boolean {
  return code === 9 || code === 10 || code === 12 || code === 13 || code === 32;
}

function isAsciiLetter(code: number): boolean {
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

/**
 * The index just past the `>` that ends a start tag whose name ends at
 * `from`, skipping a quoted attribute value whole; -1 when the tag never
 * ends.
 */
function startTagEnd(html: string, from: number): number {
  let i = from;
  while (i < html.length) {
    const char = html[i];
    if (char === '>') return i + 1;
    i += 1;
    if (char !== '=') continue;
    while (i < html.length && isHtmlSpace(html.charCodeAt(i))) i += 1;
    const quote = html[i];
    if (quote === '"' || quote === "'") {
      const close = html.indexOf(quote, i + 1);
      if (close < 0) return -1;
      i = close + 1;
    }
  }
  return -1;
}

/** Where the end tag `</name>` starts in `lower`, from `from`; -1 when there is none. */
function endTagStart(lower: string, name: string, from: number): number {
  const open = `</${name}`;
  for (let i = lower.indexOf(open, from); i >= 0;) {
    const next = lower.charCodeAt(i + open.length);
    if (isHtmlSpace(next) || next === 47 || next === 62) return i;
    i = lower.indexOf(open, i + 1);
  }
  return -1;
}

/**
 * The title of an HTML file, as the page itself would show it: the first
 * `<title>` the parser would make an element of -- not one in a comment, an
 * attribute, a script or style, a template, or an `<svg>`, whose title is a
 * tooltip -- with entities decoded and whitespace collapsed, the way
 * `document.title` reads it. Undefined when the file has none, it is blank,
 * or it is never closed.
 *
 * A scan rather than a regular expression: it reads each character a fixed
 * number of times, where a pattern for tags backtracks without bound on a
 * file of unclosed tags, which anyone who can upload could write.
 */
export function htmlPreviewTitle(html: string): string | undefined {
  const lower = html.toLowerCase();
  let i = 0;
  for (;;) {
    const open = html.indexOf('<', i);
    if (open < 0) return undefined;
    if (html.startsWith('<!--', open)) {
      const close = html.indexOf('-->', open + 4);
      if (close < 0) return undefined;
      i = close + 3;
      continue;
    }
    // End tags, doctypes, processing instructions and a stray `<` say nothing
    // about the title.
    if (!isAsciiLetter(html.charCodeAt(open + 1))) {
      i = open + 1;
      continue;
    }
    let nameEnd = open + 1;
    while (nameEnd < html.length) {
      const code = html.charCodeAt(nameEnd);
      if (isHtmlSpace(code) || code === 47 || code === 62) break;
      nameEnd += 1;
    }
    const name = lower.slice(open + 1, nameEnd);
    const tagEnd = startTagEnd(html, nameEnd);
    if (tagEnd < 0) return undefined;
    i = tagEnd;
    if (name !== 'title' && !TITLE_SKIPPED_ELEMENTS.has(name)) continue;
    // Everything after a plaintext start tag is text.
    if (name === 'plaintext') return undefined;
    const close = endTagStart(lower, name, tagEnd);
    if (close < 0) return undefined;
    if (name === 'title') {
      const title = decodeEntities(html.slice(tagEnd, close))
        .replace(/\s+/g, ' ')
        .trim();
      return title === '' ? undefined : title.slice(0, 200);
    }
    const closeEnd = html.indexOf('>', close);
    if (closeEnd < 0) return undefined;
    i = closeEnd + 1;
  }
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
 * The sandboxes for the two frames that render an HTML file on web: the
 * shell of ours (htmlPreviewShell) and the file's own frame inside it.
 *
 * The document is a stranger's: anyone who can write to the Bucket wrote it.
 * It is loaded through `srcdoc`, and an unsandboxed srcdoc document inherits
 * the app's origin -- the file's scripts would run as the app, with its
 * cookies, its database and its ship session. So `allow-same-origin` is never
 * granted to either frame: each gets an opaque origin of its own. The file's
 * frame runs its scripts and nothing more, with HTML_PREVIEW_POLICY keeping
 * them off the network, and it cannot open a window. Its links still open:
 * our script in the file's frame hands a link the reader tapped to the shell
 * (htmlPreviewDocument), and the shell, which may open windows, opens it once
 * it has checked that the reader really tapped (htmlPreviewShell).
 *
 * Under Electron scripts are withheld from both. The desktop shell starts its
 * window with `webSecurity: false` (apps/tlon-desktop/src/main/index.ts),
 * which grants every document in it universal access, so there the opaque
 * origin would not keep a script in the file out of the app's window. With
 * no scripts nothing in the file can click for the reader, so there its own
 * frame may open windows: a link the reader clicks opens as a popup, which
 * the desktop shell hands to the system browser if it is a web, mail or phone
 * link.
 */
export function htmlPreviewSandboxes({ isElectron }: { isElectron: boolean }): {
  document: string;
  shell: string;
} {
  if (isElectron) {
    const popups = 'allow-popups allow-popups-to-escape-sandbox';
    return { document: popups, shell: popups };
  }
  return {
    document: 'allow-scripts',
    shell: 'allow-scripts allow-popups allow-popups-to-escape-sandbox',
  };
}

/** The sandbox for the frame that holds an HTML file on native: scripts, and nothing else. */
export const HTML_PREVIEW_NATIVE_SANDBOX = 'allow-scripts';

/**
 * A fresh secret for one preview: 128 random bits as hex, which can sit in a
 * script or an attribute as is. A key ties the shell's script to ours in the
 * file's frame; on native a second one ties the shell to the app. The file
 * never sees either (htmlPreviewDocument, htmlPreviewShell).
 */
export function htmlPreviewKey(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
    ''
  );
}

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

/** The message that carries a tapped link, from our script in the file's frame to the shell, and on native from the shell to the app. */
export const HTML_PREVIEW_LINK_MESSAGE = 'tlon-preview-link';

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** How the shell opens a link: as a new browser tab on web, or by asking the app on native. */
export type HtmlPreviewOpener =
  | { kind: 'window' }
  | { kind: 'app'; token: string };

function openerScript(opener: HtmlPreviewOpener): string {
  if (opener.kind === 'window') {
    return "function (href) { window.open(href, '_blank', 'noopener,noreferrer'); }";
  }
  return `function (href) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: '${HTML_PREVIEW_LINK_MESSAGE}', token: '${opener.token}', href: href }));
  }`;
}

/**
 * The document the viewer loads: a shell of ours, with the file in a
 * sandboxed frame inside it.
 *
 * Four things only a parent document can provide. A sandboxed frame may
 * still navigate itself -- a script setting `location`, a meta refresh --
 * which would replace the file with a remote page; the shell's `frame-src
 * about:` lets the inline frame load and refuses every destination it could
 * be sent to. The shell's policy is inherited by the file's document, so it
 * holds however the file's own markup is shaped. A frame without
 * `allow-modals` cannot show `alert`, `confirm` or `prompt`, which on native
 * would otherwise surface as the app's own dialogs, as often as a hostile
 * script liked.
 *
 * On native the shell is the WebView's page, so it also sets the viewport:
 * a frame takes its width from its parent, not from the file's own viewport
 * tag, and without one here iOS lays the page out at desktop width and
 * shrinks it to fit. On web, inside the viewer's frame, the tag is ignored.
 *
 * And the shell opens the file's links. Our script in the file's frame posts
 * the link the reader tapped (htmlPreviewDocument); the shell's own script
 * opens it only when the message came from that frame, carries the key the
 * two scripts share, names a web, mail or phone link, and arrives while the
 * browser holds a tap on record (`navigator.userActivation`, which a tap in
 * the file's frame grants the shell as well). The file can post to the shell
 * too, but it cannot read the key, and the browser grants the tap only for
 * a real one. Nothing of the file's sits in the shell outside the escaped
 * attribute.
 */
export function htmlPreviewShell({
  document,
  key,
  opener,
  sandbox,
}: {
  document: string;
  key: string;
  opener: HtmlPreviewOpener;
  sandbox: string;
}): string {
  return (
    '<!doctype html><html><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    HTML_PREVIEW_POLICY_META +
    '<style>html,body{margin:0;height:100%;background:#fff}iframe{display:block;border:0;width:100%;height:100%}</style>' +
    `</head><body><iframe sandbox="${sandbox}" srcdoc="${escapeAttribute(document)}"></iframe>` +
    `<script>
(function (key, open) {
  'use strict';
  var frame = document.querySelector('iframe');
  var lastOpened = 0;
  window.addEventListener('message', function (event) {
    var data = event.data;
    if (!frame || event.source !== frame.contentWindow) return;
    if (!data || data.type !== '${HTML_PREVIEW_LINK_MESSAGE}' || data.key !== key || typeof data.href !== 'string') return;
    var activation = navigator.userActivation;
    if (!activation || !activation.isActive) return;
    var url;
    try { url = new URL(data.href); } catch (error) { return; }
    if (!/^(https?|mailto|tel):$/.test(url.protocol)) return;
    var now = Date.now();
    if (now - lastOpened < 500) return;
    lastOpened = now;
    open(url.href);
  });
})('${key}', ${openerScript(opener)});
</script></body></html>`
  );
}

/**
 * Where the file's doctype ends: after any byte order mark, whitespace,
 * comments and processing instructions ahead of it, the index just past its
 * `>`; -1 when the file has none. A `>` ends a DOCTYPE token in every state
 * of the HTML tokenizer, quoted identifiers included, so the first `>` is
 * where the parser's doctype ends.
 *
 * A scan rather than a regular expression, for the reason htmlPreviewTitle
 * gives: a pattern with a repeated run of whitespace backtracks exponentially
 * on a file that opens with whitespace and has no doctype.
 */
function doctypeEnd(html: string): number {
  let i = 0;
  for (;;) {
    while (i < html.length) {
      const code = html.charCodeAt(i);
      if (!isHtmlSpace(code) && code !== 0xfeff) break;
      i += 1;
    }
    if (html.startsWith('<!--', i)) {
      const close = html.indexOf('-->', i + 4);
      if (close < 0) return -1;
      i = close + 3;
    } else if (html.startsWith('<?', i)) {
      const close = html.indexOf('>', i + 2);
      if (close < 0) return -1;
      i = close + 1;
    } else {
      break;
    }
  }
  if (html.slice(i, i + 9).toLowerCase() !== '<!doctype') return -1;
  const close = html.indexOf('>', i + 9);
  return close < 0 ? -1 : close + 1;
}

/**
 * The file's markup with `fragment` placed where the parser sees it before
 * any of the file's own content: after the doctype, so that the document
 * keeps standards mode; first when there is no doctype, which is a document
 * in quirks mode already.
 */
function withDocumentHead(html: string, fragment: string): string {
  const end = doctypeEnd(html);
  if (end < 0) return fragment + html;
  return html.slice(0, end) + fragment + html.slice(end);
}

/**
 * Our script in the file's frame, which runs before any of the file's own.
 *
 * It sees every link click first, at the window, and decides what to do with
 * it only once the click has finished dispatching, so that a cancel from any
 * of the page's own handlers -- a router's, an `onclick` returning false --
 * counts, whenever they were added. Until then the frame's own default action
 * has to be harmless: a link aimed anywhere but `_blank` is pointed at
 * `_blank` for this click (an SVG link ignores the `<base>` target, and one
 * aimed at the frame itself would be refused by the shell's `frame-src`,
 * leaving Chromium's blocked-page notice behind), so the default is a popup
 * the sandbox refuses.
 *
 * Then, if the page did not cancel it: a link that leaves the file goes to
 * the shell to be opened (htmlPreviewShell); one to a place in the file
 * scrolls there, since in a srcdoc document `#section` resolves against the
 * parent's address; and a `javascript:` link runs its code in the frame, as
 * an `onclick` of the page's own could (Chromium will not run such a link in a
 * document with an opaque origin). An SVG link is followed like an HTML one.
 *
 * Only a click the reader made reaches the shell (`isTrusted`, which no
 * script can forge), with the key that marks it as ours. The key lives in
 * this function's closure, the element is gone before the file's first
 * script runs, and the messages go to the parent captured here, so nothing
 * in the file can read the key or reroute them.
 */
function linkScript(key: string): string {
  return `<script>
(function (key) {
  'use strict';
  var shell = window.parent;
  var later = window.setTimeout.bind(window);
  var composedPath = Event.prototype.composedPath;
  var resolveURL = window.URL;
  var run = Function;
  var XLINK = 'http://www.w3.org/1999/xlink';
  var SVG = 'http://www.w3.org/2000/svg';
  function hrefOf(node) {
    var raw = node.getAttribute('href');
    return raw !== null ? raw : node.getAttributeNS(XLINK, 'href');
  }
  function linkIn(event) {
    var nodes = composedPath.call(event);
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (node && node.nodeType === 1 && (node.localName === 'a' || node.localName === 'area') && hrefOf(node) !== null) return node;
    }
    return null;
  }
  function absolute(raw) {
    try { return new resolveURL(raw, document.baseURI).href; } catch (error) { return null; }
  }
  function scrollToFragment(fragment) {
    var id = fragment;
    try { id = decodeURIComponent(fragment); } catch (error) {}
    var element = id && (document.getElementById(id) || document.getElementsByName(id)[0]);
    if (element) element.scrollIntoView();
    else if (!id || id.toLowerCase() === 'top') window.scrollTo(0, 0);
  }
  function follow(event) {
    if (event.type === 'auxclick' && event.button !== 1) return;
    var link = linkIn(event);
    if (!link) return;
    var target = link.getAttribute('target');
    var aimed = target === null || target.trim() === '' ? (link.namespaceURI === SVG ? '_self' : '_blank') : target.trim().toLowerCase();
    if (aimed !== '_blank') link.setAttribute('target', '_blank');
    var trusted = event.isTrusted;
    later(function () {
      if (aimed !== '_blank') {
        if (target === null) link.removeAttribute('target');
        else link.setAttribute('target', target);
      }
      if (event.defaultPrevented) return;
      var raw = (hrefOf(link) || '').trim();
      if (/^javascript:/i.test(raw)) {
        var code;
        try { code = decodeURIComponent(raw.replace(/^javascript:/i, '')); } catch (error) { return; }
        run(code)();
        return;
      }
      if (raw === '' || raw.charAt(0) === '#') { scrollToFragment(raw.slice(1)); return; }
      if (!trusted) return;
      var href = typeof link.href === 'string' ? link.href : absolute(raw);
      if (href) shell.postMessage({ type: '${HTML_PREVIEW_LINK_MESSAGE}', key: key, href: href }, '*');
    }, 0);
  }
  window.addEventListener('click', follow, true);
  window.addEventListener('auxclick', follow, true);
  var self = document.currentScript;
  if (self) self.remove();
})('${key}');
</script>`;
}

/**
 * The file's markup as the frame loads it: the policy, `_blank` as the
 * default link target, and our link script (linkScript), ahead of the file.
 *
 * The target is the fallback for a link our script cannot see, such as one
 * inside a closed shadow root: a `_blank` link the file's frame cannot open
 * is refused outright and the preview stays as it was, where a link aimed at
 * the frame itself would be refused by the shell's `frame-src` and leave
 * Chromium's blocked-page notice behind. Under Electron, where no script
 * runs, it is what turns a link into the popup the desktop shell opens. The
 * first `<base>` with a target wins, so a `<base href>` of the file's own
 * still applies.
 */
export function htmlPreviewDocument(html: string, key: string): string {
  return withDocumentHead(
    html,
    `${HTML_PREVIEW_POLICY_META}<base target="_blank">${linkScript(key)}`
  );
}

/**
 * The link in a message the native shell sent the app, or null when the
 * message is anything else.
 *
 * The WebView hands the app the messages of every frame, the file's included
 * (iOS gives every frame the message handler; Android listens to every
 * origin), so a message counts only when it carries the token the shell was
 * rendered with, which the file, a frame of another origin, never sees. The
 * link is checked again here: a web, mail or phone link, in one piece.
 */
export function htmlPreviewLinkFromBridge(
  data: unknown,
  token: string
): string | null {
  if (typeof data !== 'string' || data.length > 8192) return null;
  let message: unknown;
  try {
    message = JSON.parse(data);
  } catch {
    return null;
  }
  if (typeof message !== 'object' || message === null) return null;
  const { href, token: sent, type } = message as Record<string, unknown>;
  if (
    type !== HTML_PREVIEW_LINK_MESSAGE ||
    sent !== token ||
    typeof href !== 'string'
  ) {
    return null;
  }
  if (!/^(?:https?|mailto|tel):/i.test(href)) return null;
  // A link the shell's browser serialized has no spaces or control characters.
  for (let i = 0; i < href.length; i++) {
    const code = href.charCodeAt(i);
    if (code <= 0x20 || code === 0x7f) return null;
  }
  return href;
}

export type HtmlPreviewNavigation = 'load' | 'block';

/**
 * What the native preview does with a navigation its WebView reports, for
 * the shell and the frame inside it alike. The inline documents load.
 * Everything else -- a link, a meta refresh, a form, a redirect, any other
 * scheme -- is refused, so a document cannot bounce the reader into another
 * app or show them a page that is not the file. A link the reader taps does
 * not come this way: our script keeps the frame from following it and the
 * shell asks the app to open it (htmlPreviewShell), so nothing here has to
 * judge whether a navigation the WebView reports came from a tap.
 */
export function htmlPreviewNavigation({
  url,
}: {
  url: string;
}): HtmlPreviewNavigation {
  return url.startsWith('about:') ? 'load' : 'block';
}
