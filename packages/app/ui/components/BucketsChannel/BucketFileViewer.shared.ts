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
 * Our script in the file's frame, which runs before any of the file's own.
 *
 * It takes a link click once the page's own handlers have had it, and keeps
 * the frame from following it: a link that leaves the file goes to the shell
 * to be opened (htmlPreviewShell); one to a place in the file scrolls there,
 * since in a srcdoc document `#section` resolves against the parent's
 * address and followed it would leave the file; and a `javascript:` link
 * runs its code in the frame, as an `onclick` of the page's own could.
 * Chromium will not run such a link in a document with an opaque origin, and
 * the `_blank` default target would send it to a window the frame cannot
 * open.
 *
 * Only a click the reader made reaches the shell (`isTrusted`, which no
 * script can forge), with the key that marks it as ours. The key lives in
 * this function's closure, the element is gone before the file's first
 * script runs, and the messages go to the parent captured here, so nothing
 * in the file can read the key or reroute them. A page that cancels its own
 * link click keeps it cancelled.
 */
function linkScript(key: string): string {
  return `<script>
(function (key) {
  'use strict';
  var shell = window.parent;
  var composedPath = Event.prototype.composedPath;
  function linkIn(event) {
    var nodes = composedPath.call(event);
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (node && node.nodeType === 1 && (node.localName === 'a' || node.localName === 'area') && node.hasAttribute('href')) return node;
    }
    return null;
  }
  function scrollToFragment(fragment) {
    var id = fragment;
    try { id = decodeURIComponent(fragment); } catch (error) {}
    var element = id && (document.getElementById(id) || document.getElementsByName(id)[0]);
    if (element) element.scrollIntoView();
    else if (!id || id.toLowerCase() === 'top') window.scrollTo(0, 0);
  }
  function follow(event) {
    if (event.defaultPrevented) return;
    if (event.type === 'auxclick' && event.button !== 1) return;
    var link = linkIn(event);
    if (!link) return;
    var raw = (link.getAttribute('href') || '').trim();
    event.preventDefault();
    if (/^javascript:/i.test(raw)) {
      var code;
      try { code = decodeURIComponent(raw.replace(/^javascript:/i, '')); } catch (error) { return; }
      Function(code)();
      return;
    }
    if (raw === '' || raw.charAt(0) === '#') { scrollToFragment(raw.slice(1)); return; }
    if (event.isTrusted && typeof link.href === 'string') {
      shell.postMessage({ type: '${HTML_PREVIEW_LINK_MESSAGE}', key: key, href: link.href }, '*');
    }
  }
  window.addEventListener('click', follow);
  window.addEventListener('auxclick', follow);
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
