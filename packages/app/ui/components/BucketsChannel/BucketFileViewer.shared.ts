import { parseEntities } from 'parse-entities';

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
 * `text` with its ASCII capitals lowercased and nothing else, as the HTML
 * parser folds tag and attribute names. Unlike `toLowerCase`, it keeps the
 * text's length (`İ` lowercases to two code units), so an offset into one is
 * an offset into the other.
 */
function asciiLowercase(text: string): string {
  return text.replace(/[A-Z]+/g, (run) => run.toLowerCase());
}

/** The attributes of a start tag, from the text between its name and its `>`; the first of a name wins. */
function tagAttributes(text: string): Map<string, string> {
  const attributes = new Map<string, string>();
  let i = 0;
  while (i < text.length) {
    while (
      i < text.length &&
      (isHtmlSpace(text.charCodeAt(i)) || text[i] === '/')
    )
      i += 1;
    const nameStart = i;
    while (
      i < text.length &&
      !isHtmlSpace(text.charCodeAt(i)) &&
      text[i] !== '=' &&
      text[i] !== '/'
    ) {
      i += 1;
    }
    const name = asciiLowercase(text.slice(nameStart, i));
    while (i < text.length && isHtmlSpace(text.charCodeAt(i))) i += 1;
    let value = '';
    if (text[i] === '=') {
      i += 1;
      while (i < text.length && isHtmlSpace(text.charCodeAt(i))) i += 1;
      const quote = text[i];
      if (quote === '"' || quote === "'") {
        const close = text.indexOf(quote, i + 1);
        const end = close < 0 ? text.length : close;
        value = text.slice(i + 1, end);
        i = end + 1;
      } else {
        const start = i;
        while (i < text.length && !isHtmlSpace(text.charCodeAt(i))) i += 1;
        value = text.slice(start, i);
      }
    }
    if (name !== '' && !attributes.has(name)) attributes.set(name, value);
    if (i === nameStart) i += 1;
  }
  return attributes;
}

/**
 * A URL attribute's raw value as the URL parser reads it: character
 * references decoded, leading and trailing spaces and control characters
 * trimmed, tabs and newlines anywhere dropped.
 */
function urlText(value: string): string {
  const url = parseEntities(value, { attribute: true });
  let start = 0;
  let end = url.length;
  while (start < end && url.charCodeAt(start) <= 0x20) start += 1;
  while (end > start && url.charCodeAt(end - 1) <= 0x20) end -= 1;
  return url.slice(start, end).replace(/[\t\n\r]/g, '');
}

const URL_SCHEME = /^([a-zA-Z][a-zA-Z0-9+.-]*):/;

/** The scheme of a URL attribute's raw value (urlText); undefined for a relative URL. */
function urlScheme(value: string): string | undefined {
  return URL_SCHEME.exec(urlText(value))?.[1].toLowerCase();
}

// The schemes a link in a preview may open: web, mail and phone.
const LINK_SCHEMES = new Set(['http', 'https', 'mailto', 'tel']);

/** `value` as an absolute web, mail or phone address, resolved against `base`; undefined for anything else. */
function linkAddress(value: string, base?: string): string | undefined {
  try {
    const url = new URL(value, base);
    return LINK_SCHEMES.has(url.protocol.slice(0, -1)) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

// How deep inline frames' documents are read: a file can nest one srcdoc in
// another as often as its size allows, and each level is read again.
const MAX_NESTED_DOCUMENTS = 3;

// The attributes whose value a browser follows as a URL, and so would run as
// a script when it is a `javascript:` one.
const URL_ATTRIBUTES = new Set([
  'action',
  'data',
  'formaction',
  'href',
  'src',
  'xlink:href',
]);

/**
 * The charset an HTML file declares in its first bytes, found as a browser's
 * encoding prescan finds it: comments are skipped, and only a `<meta>` with a
 * `charset` attribute, or one with `http-equiv="content-type"` whose
 * `content` names a charset, declares one. `charset=` anywhere else -- in a
 * comment, in a description -- does not.
 */
function metaCharset(head: string): string | undefined {
  let i = 0;
  for (;;) {
    const open = head.indexOf('<', i);
    if (open < 0) return undefined;
    if (head.startsWith('<!--', open)) {
      // The prescan's comment ends at the first `-->`, whose dashes may be
      // the opener's own (`<!-->`).
      const close = head.indexOf('-->', open + 2);
      if (close < 0) return undefined;
      i = close + 3;
      continue;
    }
    if (!isAsciiLetter(head.charCodeAt(open + 1))) {
      i = open + 1;
      continue;
    }
    let nameEnd = open + 1;
    while (nameEnd < head.length) {
      const code = head.charCodeAt(nameEnd);
      if (isHtmlSpace(code) || code === 47 || code === 62) break;
      nameEnd += 1;
    }
    const tagEnd = startTagEnd(head, nameEnd);
    if (tagEnd < 0) return undefined;
    i = tagEnd;
    if (asciiLowercase(head.slice(open + 1, nameEnd)) !== 'meta') continue;
    const attributes = tagAttributes(head.slice(nameEnd, tagEnd - 1));
    const charset = attributes.get('charset')?.trim();
    if (charset) return charset;
    if (attributes.get('http-equiv')?.trim().toLowerCase() === 'content-type') {
      const declared = attributes
        .get('content')
        ?.match(/charset\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s;"']+))/i);
      const value = (declared?.[1] ?? declared?.[2] ?? declared?.[3])?.trim();
      if (value) return value;
    }
  }
}

/**
 * The encoding an XML declaration at the very start of an HTML file names
 * (`<?xml version="1.0" encoding="windows-1252"?>`), which a browser's
 * prescan falls back to when no `<meta>` declares one; undefined when the
 * file does not open with one, or it names none.
 */
function xmlEncoding(head: string): string | undefined {
  if (!head.startsWith('<?xml')) return undefined;
  const end = head.indexOf('>');
  let i = head.indexOf('encoding', 5);
  if (end < 0 || i < 0 || i > end) return undefined;
  i += 8;
  while (i < head.length && head.charCodeAt(i) <= 0x20) i += 1;
  if (head[i] !== '=') return undefined;
  i += 1;
  while (i < head.length && head.charCodeAt(i) <= 0x20) i += 1;
  const quote = head[i];
  if (quote !== '"' && quote !== "'") return undefined;
  const close = head.indexOf(quote, i + 1);
  if (close < 0) return undefined;
  const label = head.slice(i + 1, close);
  for (let j = 0; j < label.length; j += 1) {
    if (label.charCodeAt(j) <= 0x20) return undefined;
  }
  return label;
}

/**
 * The encoding a preview's bytes are in, decided as a browser decides for a
 * page: a byte order mark first, then the charset the response declares,
 * then -- for HTML -- the prescan of the first 1024 bytes: an XML declaration
 * in UTF-16 bytes, a `<meta>` charset, and failing that an XML declaration's
 * encoding; UTF-8 when nothing says otherwise. `head` is the start of the
 * bytes, one byte per character. A declaration that names UTF-16 is read as
 * UTF-8, as browsers do: ASCII cannot be found in a document that really is
 * UTF-16.
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
    if (head.startsWith('<\u0000?\u0000x\u0000')) return 'utf-16le';
    if (head.startsWith('\u0000<\u0000?\u0000x')) return 'utf-16be';
    const prescan = head.slice(0, 1024);
    const declared = (
      metaCharset(prescan) ?? xmlEncoding(prescan)
    )?.toLowerCase();
    if (declared) return declared.startsWith('utf-16') ? 'utf-8' : declared;
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

// The labels the Encoding Standard reads as UTF-16, little-endian unless named
// otherwise.
const UTF_16LE_LABELS = new Set([
  'csunicode',
  'iso-10646-ucs-2',
  'ucs-2',
  'unicode',
  'unicodefeff',
  'utf-16',
  'utf-16le',
]);
const UTF_16BE_LABELS = new Set(['unicodefffe', 'utf-16be']);

function decodeUtf16(bytes: Uint8Array, littleEndian: boolean): string {
  let i = 0;
  if (
    bytes.length >= 2 &&
    bytes[0] === (littleEndian ? 0xff : 0xfe) &&
    bytes[1] === (littleEndian ? 0xfe : 0xff)
  ) {
    i = 2;
  }
  let text = '';
  for (; i + 1 < bytes.length; i += 2) {
    text += String.fromCharCode(
      littleEndian
        ? bytes[i] | (bytes[i + 1] << 8)
        : (bytes[i] << 8) | bytes[i + 1]
    );
  }
  return i < bytes.length ? text + '�' : text;
}

/**
 * The bytes as text in `encoding`. Where the runtime's TextDecoder knows the
 * encoding, it decodes. Expo's, which React Native apps get, knows only
 * UTF-8, so windows-1252 -- the encoding of most legacy Western pages, and
 * what ISO-8859-1 means to a browser -- and UTF-16 are decoded here instead.
 * Any other encoding it does not know is read as UTF-8.
 */
function decodeBytes(bytes: Uint8Array, encoding: string): string {
  try {
    return new TextDecoder(encoding).decode(bytes);
  } catch {
    if (WINDOWS_1252_LABELS.has(encoding)) return decodeWindows1252(bytes);
    if (UTF_16LE_LABELS.has(encoding)) return decodeUtf16(bytes, true);
    if (UTF_16BE_LABELS.has(encoding)) return decodeUtf16(bytes, false);
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
  // not as source. The name decides only when the type says nothing else: it
  // is missing, the upload fallback, or text. Renaming a file changes its
  // name, not its type, so a PDF renamed to .html is still a PDF.
  const typeDefersToName =
    normalizedMimeType === '' ||
    normalizedMimeType === 'application/octet-stream' ||
    normalizedMimeType.startsWith('text/');
  if (
    normalizedMimeType === 'text/html' ||
    (typeDefersToName && ['html', 'htm'].includes(extension ?? ''))
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

// Elements whose content the parser reads as text, not markup, for the
// document's title: the raw-text and escapable raw-text elements, and
// noscript, which is raw text with scripting on.
const TITLE_TEXT_ELEMENTS = new Set([
  'iframe',
  'noembed',
  'noframes',
  'noscript',
  'script',
  'style',
  'textarea',
  'xmp',
]);

// Elements whose content is not the document's own -- template content is
// inert, and inside svg or math a title is the drawing's and a base sets
// nothing -- and which can nest.
const INERT_ELEMENTS = new Set(['math', 'svg', 'template']);

// The elements that open foreign content, where the parser reads no
// element's content as text: inside an svg, a title, style or script holds
// markup. They can nest.
const FOREIGN_ELEMENTS = new Set(['math', 'svg']);

/** Whether the start tag that ends at `tagEnd` closes itself (`<svg/>`). */
function closesItself(html: string, tagEnd: number): boolean {
  return html.charCodeAt(tagEnd - 2) === 47;
}

// HTML's ASCII whitespace: tab, line feed, form feed, carriage return, space.
function isHtmlSpace(code: number): boolean {
  return code === 9 || code === 10 || code === 12 || code === 13 || code === 32;
}

function isAsciiLetter(code: number): boolean {
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

/**
 * The index just past the `>` that ends a tag whose name ends at `from`; -1
 * when the tag never ends. It reads the attributes in the tokenizer's states:
 * a quote opens a quoted value only straight after an attribute's `=`, so one
 * inside a name or an unquoted value (`data=x="`) is just a character there.
 */
function startTagEnd(html: string, from: number): number {
  let i = from;
  for (;;) {
    while (
      i < html.length &&
      (isHtmlSpace(html.charCodeAt(i)) || html[i] === '/')
    ) {
      i += 1;
    }
    if (i >= html.length) return -1;
    if (html[i] === '>') return i + 1;
    // A name: its first character whatever it is, then up to a space, a
    // slash, a `>` or an `=`.
    i += 1;
    while (i < html.length) {
      const char = html[i];
      if (
        char === '>' ||
        char === '/' ||
        char === '=' ||
        isHtmlSpace(html.charCodeAt(i))
      ) {
        break;
      }
      i += 1;
    }
    while (i < html.length && isHtmlSpace(html.charCodeAt(i))) i += 1;
    if (html[i] !== '=') continue;
    i += 1;
    while (i < html.length && isHtmlSpace(html.charCodeAt(i))) i += 1;
    const quote = html[i];
    if (quote === '"' || quote === "'") {
      const close = html.indexOf(quote, i + 1);
      if (close < 0) return -1;
      i = close + 1;
    } else {
      while (
        i < html.length &&
        html[i] !== '>' &&
        !isHtmlSpace(html.charCodeAt(i))
      ) {
        i += 1;
      }
    }
  }
}

/**
 * Where a scan resumes past what starts at `open` when that is not a tag, as
 * the tokenizer reads it: a comment, which ends at its first `-->` or `--!>`,
 * or at once as `<!-->` or `<!--->`; in foreign content a CDATA section, at
 * its `]]>`; and a doctype, a processing instruction, or any other `<!`, or
 * `</` before something other than a letter, at the next `>`. -1 when one
 * runs to the end of the file; undefined when a tag starts at `open`, or a
 * stray `<` that is text.
 */
function pastNonTag(
  html: string,
  open: number,
  foreign: boolean
): number | undefined {
  if (html.startsWith('<!--', open)) {
    if (html[open + 4] === '>') return open + 5;
    if (html.startsWith('->', open + 4)) return open + 6;
    for (
      let dashes = html.indexOf('--', open + 4);
      dashes >= 0;
      dashes = html.indexOf('--', dashes + 1)
    ) {
      if (html[dashes + 2] === '>') return dashes + 3;
      if (html.startsWith('!>', dashes + 2)) return dashes + 4;
    }
    return -1;
  }
  if (foreign && html.startsWith('<![CDATA[', open)) {
    const close = html.indexOf(']]>', open + 9);
    return close < 0 ? -1 : close + 3;
  }
  const next = html[open + 1];
  if (
    next === '!' ||
    next === '?' ||
    (next === '/' &&
      open + 2 < html.length &&
      !isAsciiLetter(html.charCodeAt(open + 2)))
  ) {
    const close = html.indexOf('>', open + 2);
    return close < 0 ? -1 : close + 1;
  }
  return undefined;
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
 * `<title>` the parser would make the document's -- not one in a comment, an
 * attribute, a script or style, a template (nested ones included), or an
 * `<svg>`, whose title is a tooltip -- with character references decoded and
 * ASCII whitespace collapsed, the way `document.title` reads it. Undefined
 * when the file has none, it is blank, or it is never closed. In a frame that
 * runs no scripts (`scripting: false`, under Electron), a `<noscript>` holds
 * markup, and a title in it counts.
 *
 * A scan rather than a regular expression: it reads each character a fixed
 * number of times, where a pattern for tags backtracks without bound on a
 * file of unclosed tags, which anyone who can upload could write.
 */
export function htmlPreviewTitle(
  html: string,
  { scripting = true }: { scripting?: boolean } = {}
): string | undefined {
  const lower = asciiLowercase(html);
  // How many template, svg and math elements are open around the scan, and
  // how many of those are svg or math.
  let inert = 0;
  let foreign = 0;
  let i = 0;
  for (;;) {
    const open = html.indexOf('<', i);
    if (open < 0) return undefined;
    const past = pastNonTag(html, open, foreign > 0);
    if (past !== undefined) {
      if (past < 0) return undefined;
      i = past;
      continue;
    }
    const closing = html.charCodeAt(open + 1) === 47;
    const nameStart = open + (closing ? 2 : 1);
    if (!isAsciiLetter(html.charCodeAt(nameStart))) {
      i = open + 1;
      continue;
    }
    let nameEnd = nameStart;
    while (nameEnd < html.length) {
      const code = html.charCodeAt(nameEnd);
      if (isHtmlSpace(code) || code === 47 || code === 62) break;
      nameEnd += 1;
    }
    const name = lower.slice(nameStart, nameEnd);
    const tagEnd = startTagEnd(html, nameEnd);
    if (tagEnd < 0) return undefined;
    i = tagEnd;
    if (closing) {
      if (inert > 0 && INERT_ELEMENTS.has(name)) inert -= 1;
      if (foreign > 0 && FOREIGN_ELEMENTS.has(name)) foreign -= 1;
      continue;
    }
    if (INERT_ELEMENTS.has(name)) {
      // A self-closed svg or math has no content; a template always opens.
      if (name === 'template' || !closesItself(html, tagEnd)) {
        inert += 1;
        if (FOREIGN_ELEMENTS.has(name)) foreign += 1;
      }
      continue;
    }
    if (foreign > 0) continue;
    // Everything after a plaintext start tag is text.
    if (name === 'plaintext') return undefined;
    if (name === 'noscript' && !scripting) continue;
    if (name !== 'title' && !TITLE_TEXT_ELEMENTS.has(name)) continue;
    const close = endTagStart(lower, name, tagEnd);
    if (close < 0) return undefined;
    if (name === 'title' && inert === 0) {
      // Character references decoded as a browser decodes them in text: every
      // named reference, the legacy ones without a semicolon, and numeric
      // references with a browser's replacements.
      const title = parseEntities(html.slice(tagEnd, close))
        .replace(/[\t\n\f\r ]+/g, ' ')
        .replace(/^ | $/g, '');
      return title === '' ? undefined : title.slice(0, 200);
    }
    const closeEnd = html.indexOf('>', close);
    if (closeEnd < 0) return undefined;
    i = closeEnd + 1;
  }
}

/**
 * What the viewer's header says about a file. A rendered HTML page is named
 * by its own title (htmlPreviewTitle, read as a frame that runs scripts or
 * one that does not reads it), with the file's name and size beneath it;
 * anything else by its file name, with its size.
 */
export function bucketFileViewerHeading(
  item: BucketFileViewerItem,
  { scripting = true }: { scripting?: boolean } = {}
): {
  subtitle: string;
  title: string;
} {
  const pageTitle =
    getBucketPreviewKind(item) === 'html' && item.textContent !== undefined
      ? htmlPreviewTitle(item.textContent, { scripting })
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
 * Whose scripts a preview runs: the file's and ours (`all`: iOS and Android,
 * and web once the reader asks), ours alone (`ours`: web until then), or none
 * (`none`: under Electron). On web a file's script runs on the app's own
 * thread, where a loop that never ends would freeze the whole tab, so there
 * it waits for the reader (BucketFileViewer).
 */
export type HtmlPreviewScripts = 'all' | 'ours' | 'none';

/**
 * The sandboxes for the two frames that render an HTML file on web: the
 * shell of ours (htmlPreviewShell) and the file's own frame inside it.
 *
 * The document is a stranger's: anyone who can write to the Bucket wrote it.
 * It is loaded through `srcdoc`, and an unsandboxed srcdoc document inherits
 * the app's origin -- the file's scripts would run as the app, with its
 * cookies, its database and its ship session. So `allow-same-origin` is never
 * granted to either frame: each gets an opaque origin of its own.
 *
 * When scripts run -- the file's and ours, or ours alone while the file's are
 * held -- its frame gets them and nothing more, with the policy keeping them
 * off the network, and it cannot open a window. Its links still open: our
 * script in the file's frame hands a link the reader tapped to the shell
 * (htmlPreviewDocument), and the shell, which may open windows, opens it once
 * it has checked that the reader really tapped (htmlPreviewShell).
 *
 * Under Electron neither frame runs a script, so nothing in the file can
 * click for the reader, and its own frame may open windows: a link the reader
 * clicks opens as a popup, which the desktop shell sends to the system
 * browser. The desktop shell starts its window with `webSecurity: false`
 * (apps/tlon-desktop/src/main/index.ts), which grants every document in it
 * universal access, so there the opaque origin would not keep a script in
 * the file out of the app's window.
 */
export function htmlPreviewSandboxes({
  scripts,
}: {
  scripts: HtmlPreviewScripts;
}): {
  document: string;
  shell: string;
} {
  if (scripts === 'none') {
    const popups = 'allow-popups allow-popups-to-escape-sandbox';
    return { document: popups, shell: popups };
  }
  return {
    document: 'allow-scripts',
    shell: 'allow-scripts allow-popups allow-popups-to-escape-sandbox',
  };
}

/**
 * Whether an HTML file has anything a script would run from: a script
 * element, an event handler attribute, a `javascript:` URL in an attribute a
 * browser follows -- read as the browser reads it, so `java&#x73;cript:`
 * counts -- or any of these in an inline frame's `srcdoc`. A page without
 * any renders the same with scripts off, so there is nothing to run. A
 * `srcdoc` nested deeper than MAX_NESTED_DOCUMENTS is taken to have some.
 *
 * The same linear scan as the title's, per document: comments, and the text
 * inside script, style, textarea and the like, are not markup.
 */
export function htmlPreviewHasScripts(html: string, depth = 0): boolean {
  const lower = asciiLowercase(html);
  // How many svg and math elements are open around the scan.
  let foreign = 0;
  let i = 0;
  for (;;) {
    const open = html.indexOf('<', i);
    if (open < 0) return false;
    const past = pastNonTag(html, open, foreign > 0);
    if (past !== undefined) {
      if (past < 0) return false;
      i = past;
      continue;
    }
    const closing = html.charCodeAt(open + 1) === 47;
    const nameStart = open + (closing ? 2 : 1);
    if (!isAsciiLetter(html.charCodeAt(nameStart))) {
      i = open + 1;
      continue;
    }
    let nameEnd = nameStart;
    while (nameEnd < html.length) {
      const code = html.charCodeAt(nameEnd);
      if (isHtmlSpace(code) || code === 47 || code === 62) break;
      nameEnd += 1;
    }
    const name = lower.slice(nameStart, nameEnd);
    if (!closing && name === 'script') return true;
    const tagEnd = startTagEnd(html, nameEnd);
    if (tagEnd < 0) return false;
    i = tagEnd;
    if (closing) {
      if (foreign > 0 && FOREIGN_ELEMENTS.has(name)) foreign -= 1;
      continue;
    }
    for (const [attribute, value] of tagAttributes(
      html.slice(nameEnd, tagEnd - 1)
    )) {
      if (attribute.length > 2 && attribute.startsWith('on')) return true;
      if (URL_ATTRIBUTES.has(attribute) && urlScheme(value) === 'javascript') {
        return true;
      }
      if (
        attribute === 'srcdoc' &&
        (depth >= MAX_NESTED_DOCUMENTS ||
          htmlPreviewHasScripts(
            parseEntities(value, { attribute: true }),
            depth + 1
          ))
      ) {
        return true;
      }
    }
    if (FOREIGN_ELEMENTS.has(name)) {
      if (!closesItself(html, tagEnd)) foreign += 1;
    } else if (foreign === 0 && TEXT_CONTENT_ELEMENTS.has(name)) {
      const close = endTagStart(lower, name, tagEnd);
      if (close < 0) return false;
      i = close;
    }
  }
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

// The public CDNs a preview may load libraries, styles, fonts and images
// from. None of them can be a reader's ship.
const PREVIEW_CDNS =
  'https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://unpkg.com';

/**
 * The policy every HTML preview runs under.
 *
 * Nothing may load from the reader's ship, nor from anywhere a page's author
 * controls. On web the frame sits on the ship's own page and the ship's
 * cookie is `SameSite=None`, so a request from the frame to the ship goes out
 * with the reader's session; under Electron the desktop shell attaches the
 * cookie to every request for the ship's address; on Android every WebView
 * shares the cookie jar React Native's networking keeps it in. Urbit logs out
 * on a GET to `/~/logout`, so a page whose `<img>` pointed there would sign
 * the reader out just by being opened, and any other GET on the ship would go
 * out as them. A source list cannot name everything but the ship, so the
 * policy names what may load instead: inline scripts and styles and `data:`
 * or `blob:` resources, which never leave the device, and libraries, styles,
 * fonts and images from the public CDNs above (plus Google Fonts), which no
 * one can make into a ship. Everything else is refused, the ship and any host
 * that could count the page's views among them.
 *
 * Beyond loading, the document may open no connection -- not by fetch, not
 * by a socket, not by a beacon -- its forms cannot submit (Android never
 * reports a POST navigation to the load handler), no object may load in it,
 * and the only frame it may hold is an inline one, which inherits this same
 * policy. It still runs its scripts against its own DOM.
 *
 * The policy is delivered by the shell (htmlPreviewShell), whose markup the
 * file cannot reach: a document loaded through `srcdoc` inherits the policy
 * of the document that holds it, in Chromium and WebKit alike. It is placed
 * into the file's own markup as well (htmlPreviewDocument), so that it holds
 * even where that inheritance did not.
 */
const PREVIEW_LOADS = [
  `style-src 'unsafe-inline' data: blob: ${PREVIEW_CDNS} https://fonts.googleapis.com`,
  `font-src data: ${PREVIEW_CDNS} https://fonts.gstatic.com`,
  `img-src data: blob: ${PREVIEW_CDNS}`,
  'media-src data: blob:',
];
const PREVIEW_LIMITS = [
  "connect-src 'none'",
  "form-action 'none'",
  'frame-src about:',
  "object-src 'none'",
];

export const HTML_PREVIEW_POLICY = [
  "default-src 'none'",
  `script-src 'unsafe-inline' 'unsafe-eval' data: blob: ${PREVIEW_CDNS} https://cdn.tailwindcss.com https://code.jquery.com`,
  ...PREVIEW_LOADS,
  'worker-src blob:',
  ...PREVIEW_LIMITS,
].join('; ');

/**
 * The policy while a file's scripts are held: the same loads and limits as
 * HTML_PREVIEW_POLICY, but the only scripts that run carry `nonce`, and only
 * ours do. The file's own -- inline or from a CDN, an event handler
 * attribute, a `javascript:` URL, one in an inline frame -- are refused, and
 * the file cannot learn the nonce, fresh for each preview, without a script
 * of its own. So the browser itself decides which links the file has, and
 * our script handles them as when the file's scripts run.
 */
export function htmlPreviewHeldPolicy(nonce: string): string {
  return [
    "default-src 'none'",
    `script-src 'nonce-${nonce}'`,
    ...PREVIEW_LOADS,
    ...PREVIEW_LIMITS,
  ].join('; ');
}

function policyMeta(policy: string): string {
  return `<meta http-equiv="Content-Security-Policy" content="${policy}">`;
}

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
 *
 * While the file's scripts are held, pass the `nonce` the file's document was
 * made with: the shell then carries the held policy, which the file's
 * document inherits, and its own script carries the nonce.
 */
export function htmlPreviewShell({
  document,
  key,
  nonce,
  opener,
  sandbox,
}: {
  document: string;
  key: string;
  nonce?: string;
  opener: HtmlPreviewOpener;
  sandbox: string;
}): string {
  const policy =
    nonce === undefined ? HTML_PREVIEW_POLICY : htmlPreviewHeldPolicy(nonce);
  return (
    '<!doctype html><html><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    policyMeta(policy) +
    '<style>html,body{margin:0;height:100%;background:#fff}iframe{display:block;border:0;width:100%;height:100%}</style>' +
    `</head><body><iframe sandbox="${sandbox}" srcdoc="${escapeAttribute(document)}"></iframe>` +
    `<script${nonce === undefined ? '' : ` nonce="${nonce}"`}>
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
 * `>`; -1 when the file has none. Comments end where the tokenizer ends them
 * (pastNonTag): what we place here must come before anything of the file's
 * that could run. A `>` ends a DOCTYPE token in every state
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
    if (!html.startsWith('<!--', i) && !html.startsWith('<?', i)) break;
    const past = pastNonTag(html, i, false);
    if (past === undefined || past < 0) return -1;
    i = past;
  }
  if (asciiLowercase(html.slice(i, i + 9)) !== '<!doctype') return -1;
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
 * parent's address (unless the file sets a `<base href>` of its own, when the
 * fragment names that address and leaves the file like any other link); and
 * a `javascript:` link runs its code in the frame, as an `onclick` of the
 * page's own could (Chromium will not run such a link in a document with an
 * opaque origin) -- unless the file's scripts are held, when it is the file's
 * code and does nothing. An SVG link is followed like an HTML one.
 *
 * Only a click the reader made reaches the shell (`isTrusted`, which no
 * script can forge), with the key that marks it as ours. The key lives in
 * this function's closure, the element is gone before the file's first
 * script runs, and the messages go to the parent captured here, so nothing
 * in the file can read the key or reroute them.
 */
function linkScript(key: string, nonce?: string): string {
  return `<script${nonce === undefined ? '' : ` nonce="${nonce}"`}>
(function (key, runsJavascriptLinks) {
  'use strict';
  var shell = window.parent;
  var later = window.setTimeout.bind(window);
  var composedPath = Event.prototype.composedPath;
  var resolveURL = window.URL;
  var run = Function;
  var XLINK = 'http://www.w3.org/1999/xlink';
  var SVG = 'http://www.w3.org/2000/svg';
  var XHTML = 'http://www.w3.org/1999/xhtml';
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
  // A URL attribute as the URL parser reads it: spaces and controls
  // trimmed, tabs and newlines anywhere dropped.
  function urlText(value) {
    return (value || '').replace(/^[\\u0000-\\u0020]+|[\\u0000-\\u0020]+$/g, '').replace(/[\\t\\n\\r]/g, '');
  }
  function parse(raw, base) {
    try { return new resolveURL(raw, base); } catch (error) { return null; }
  }
  // The file's own base: the document's first HTML <base href>, when it is
  // an absolute web address, or a scheme-relative one, which takes https as
  // a link does. With any other the browser would resolve a relative link
  // against the app's address.
  function webBase() {
    var elements = document.querySelectorAll('base[href]');
    for (var i = 0; i < elements.length; i++) {
      if (elements[i].namespaceURI !== XHTML) continue;
      var href = urlText(elements[i].getAttribute('href'));
      var url = parse(href.slice(0, 2) === '//' ? 'https:' + href : href);
      return url && /^https?:$/.test(url.protocol) ? url.href : null;
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
      var raw = urlText(hrefOf(link));
      if (/^javascript:/i.test(raw)) {
        if (!runsJavascriptLinks) return;
        var code;
        try { code = decodeURIComponent(raw.replace(/^javascript:/i, '')); } catch (error) { return; }
        run(code)();
        return;
      }
      // A relative link resolves only against a web base the file sets
      // itself: a Bucket file has no address of its own its neighbours could
      // be reached from. Without one a fragment, or an empty href, stays in
      // the file, and a scheme-relative link takes https. Each address is
      // computed here, never left to resolve against the app's.
      var scheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw);
      var base = scheme ? null : webBase();
      if (!scheme && !base && (raw === '' || raw.charAt(0) === '#')) { scrollToFragment(raw.slice(1)); return; }
      if (!trusted) return;
      var url = scheme ? parse(raw) : base ? parse(raw, base) : raw.slice(0, 2) === '//' ? parse('https:' + raw) : null;
      if (url) shell.postMessage({ type: '${HTML_PREVIEW_LINK_MESSAGE}', key: key, href: url.href }, '*');
    }, 0);
  }
  window.addEventListener('click', follow, true);
  window.addEventListener('auxclick', follow, true);
  var self = document.currentScript;
  if (self) self.remove();
})('${key}', ${nonce === undefined});
</script>`;
}

// Elements whose content the parser reads as text, not markup: the raw-text
// and escapable raw-text elements, and plaintext. (In a frame without
// scripts, noscript's content is markup.)
const TEXT_CONTENT_ELEMENTS = new Set([
  'iframe',
  'noembed',
  'noframes',
  'plaintext',
  'script',
  'style',
  'textarea',
  'title',
  'xmp',
]);

/** A start tag's attribute text without the attributes `names` lists. */
function withoutAttributes(attributes: string, names: Set<string>): string {
  let kept = '';
  let i = 0;
  while (i < attributes.length) {
    const start = i;
    while (
      i < attributes.length &&
      (isHtmlSpace(attributes.charCodeAt(i)) || attributes[i] === '/')
    ) {
      i += 1;
    }
    const nameStart = i;
    while (
      i < attributes.length &&
      !isHtmlSpace(attributes.charCodeAt(i)) &&
      attributes[i] !== '=' &&
      attributes[i] !== '/'
    ) {
      i += 1;
    }
    const name = asciiLowercase(attributes.slice(nameStart, i));
    let valueEnd = i;
    while (
      valueEnd < attributes.length &&
      isHtmlSpace(attributes.charCodeAt(valueEnd))
    ) {
      valueEnd += 1;
    }
    if (attributes[valueEnd] === '=') {
      valueEnd += 1;
      while (
        valueEnd < attributes.length &&
        isHtmlSpace(attributes.charCodeAt(valueEnd))
      ) {
        valueEnd += 1;
      }
      const quote = attributes[valueEnd];
      if (quote === '"' || quote === "'") {
        const close = attributes.indexOf(quote, valueEnd + 1);
        valueEnd = close < 0 ? attributes.length : close + 1;
      } else {
        while (
          valueEnd < attributes.length &&
          !isHtmlSpace(attributes.charCodeAt(valueEnd))
        ) {
          valueEnd += 1;
        }
      }
      i = valueEnd;
    }
    if (!names.has(name)) kept += attributes.slice(start, i);
    if (i === start) {
      kept += attributes[i];
      i += 1;
    }
  }
  return kept;
}

/**
 * The `href` of the first `<base href>` that sets the document's base, as
 * the title scan reads the document: markup, not a comment or the text of a
 * script or the like, and not inside a template, an svg or math, where a
 * base sets nothing. Undefined when the file has none.
 */
function authoredBaseHref(html: string): string | undefined {
  const lower = asciiLowercase(html);
  // How many template, svg and math elements are open around the scan, and
  // how many of those are svg or math.
  let inert = 0;
  let foreign = 0;
  let i = 0;
  for (;;) {
    const open = html.indexOf('<', i);
    if (open < 0) return undefined;
    const past = pastNonTag(html, open, foreign > 0);
    if (past !== undefined) {
      if (past < 0) return undefined;
      i = past;
      continue;
    }
    const closing = html.charCodeAt(open + 1) === 47;
    const nameStart = open + (closing ? 2 : 1);
    if (!isAsciiLetter(html.charCodeAt(nameStart))) {
      i = open + 1;
      continue;
    }
    let nameEnd = nameStart;
    while (nameEnd < html.length) {
      const code = html.charCodeAt(nameEnd);
      if (isHtmlSpace(code) || code === 47 || code === 62) break;
      nameEnd += 1;
    }
    const name = lower.slice(nameStart, nameEnd);
    const tagEnd = startTagEnd(html, nameEnd);
    if (tagEnd < 0) return undefined;
    i = tagEnd;
    if (closing) {
      if (inert > 0 && INERT_ELEMENTS.has(name)) inert -= 1;
      if (foreign > 0 && FOREIGN_ELEMENTS.has(name)) foreign -= 1;
      continue;
    }
    if (INERT_ELEMENTS.has(name)) {
      // A self-closed svg or math has no content; a template always opens.
      if (name === 'template' || !closesItself(html, tagEnd)) {
        inert += 1;
        if (FOREIGN_ELEMENTS.has(name)) foreign += 1;
      }
      continue;
    }
    if (foreign > 0) continue;
    if (name === 'plaintext') return undefined;
    if (name === 'base' && inert === 0) {
      const href = tagAttributes(html.slice(nameEnd, tagEnd - 1)).get('href');
      if (href !== undefined) return href;
    }
    if (TEXT_CONTENT_ELEMENTS.has(name)) {
      const close = endTagStart(lower, name, tagEnd);
      if (close < 0) return undefined;
      i = close;
    }
  }
}

/**
 * The file's own base, when its relative links may resolve against it: the
 * first `<base href>` (authoredBaseHref), when that is an absolute web
 * address, or a scheme-relative one, which takes https as a link does. No
 * base, a relative one or one that does not parse gives them nowhere to go:
 * a Bucket file has no address of its own its neighbours could be reached
 * from.
 */
function fileWebBase(html: string): string | undefined {
  const href = authoredBaseHref(html);
  if (href === undefined) return undefined;
  const value = urlText(href);
  const base = linkAddress(value.startsWith('//') ? `https:${value}` : value);
  return base !== undefined && /^https?:/.test(base) ? base : undefined;
}

/**
 * Where a link in a frame without scripts goes, and in which window: an
 * absolute address computed here, or none at all.
 */
function settledLink(
  raw: string | undefined,
  base: string | undefined
): { address?: string; aimed: '_blank' | '_self' } {
  if (raw === undefined) return { aimed: '_blank' };
  const value = urlText(raw);
  if (URL_SCHEME.test(value)) {
    return { address: linkAddress(value), aimed: '_blank' };
  }
  if (base !== undefined) {
    return { address: linkAddress(value, base), aimed: '_blank' };
  }
  if (value === '' || value[0] === '#') {
    return { address: `about:srcdoc#${value.slice(1)}`, aimed: '_self' };
  }
  if (value.startsWith('//')) {
    return { address: linkAddress(`https:${value}`), aimed: '_blank' };
  }
  return { aimed: '_blank' };
}

const LINK_ATTRIBUTES = new Set(['href', 'target', 'xlink:href']);
const SRCDOC_ATTRIBUTE = new Set(['srcdoc']);

/**
 * The file's markup with every link -- `<a>` and `<area>`, HTML or SVG --
 * made safe to follow with no script running, as under Electron. A link the
 * scan misreads still opens only through the desktop shell's window-open
 * handler, which hands the system browser web, mail and phone addresses
 * alone, and there a relative address resolves against the app's `file:` one.
 *
 * Its own frame opens a link as a popup that escapes the sandbox, with no
 * script of ours to check where it goes, so each link is settled here
 * (settledLink), and an address it keeps is an absolute one computed here.
 * Left to the browser, a relative one -- `help.html`, `https:/path`, or one
 * under a `<base>` the browser does not use -- would resolve against the
 * app's own address, the reader's ship.
 *
 * - A web, mail or phone link is aimed at `_blank`, whatever its target was:
 *   one aimed at the frame itself would be refused by the shell's
 *   `frame-src`, and an SVG link ignores the `<base>` target.
 * - Any other scheme -- `data:`, `javascript:`, `file:`, an app's own -- loses
 *   its address and with it its link, so no click can open an unsandboxed
 *   document or hand an address to another app.
 * - A relative link resolves against the file's own base (fileWebBase), and
 *   without one goes nowhere, except that a fragment stays in the file: it
 *   points at `about:srcdoc#section`, aimed at the frame itself, which
 *   scrolls there without reloading. A scheme-relative one takes https.
 * - A document in an `<iframe srcdoc>` inherits the frame's popups, so its
 *   links are settled too, MAX_NESTED_DOCUMENTS deep; a `srcdoc` deeper than
 *   that is dropped.
 *
 * With no script to change it, the markup is the document, so rewriting it
 * covers every link. The same linear scan as the title's, per document;
 * comments, and the text inside script, style, title and the like outside an
 * svg or math, are left as they are.
 */
function withLinksAimedAtBlank(html: string, depth = 0): string {
  const base = fileWebBase(html);
  const lower = asciiLowercase(html);
  // How many svg and math elements are open around the scan.
  let foreign = 0;
  let rewritten = '';
  let copied = 0;
  let i = 0;
  for (;;) {
    const open = html.indexOf('<', i);
    if (open < 0) break;
    const past = pastNonTag(html, open, foreign > 0);
    if (past !== undefined) {
      if (past < 0) break;
      i = past;
      continue;
    }
    const closing = html.charCodeAt(open + 1) === 47;
    const nameStart = open + (closing ? 2 : 1);
    if (!isAsciiLetter(html.charCodeAt(nameStart))) {
      i = open + 1;
      continue;
    }
    let nameEnd = nameStart;
    while (nameEnd < html.length) {
      const code = html.charCodeAt(nameEnd);
      if (isHtmlSpace(code) || code === 47 || code === 62) break;
      nameEnd += 1;
    }
    const name = lower.slice(nameStart, nameEnd);
    const tagEnd = startTagEnd(html, nameEnd);
    if (tagEnd < 0) break;
    if (closing) {
      if (foreign > 0 && FOREIGN_ELEMENTS.has(name)) foreign -= 1;
      i = tagEnd;
      continue;
    }
    if (name === 'a' || name === 'area') {
      const attributes = html.slice(nameEnd, tagEnd - 1);
      const values = tagAttributes(attributes);
      const { address, aimed } = settledLink(
        values.get('href') ?? values.get('xlink:href'),
        base
      );
      rewritten +=
        html.slice(copied, nameEnd) +
        ` target="${aimed}"` +
        (address === undefined ? '' : ` href="${escapeAttribute(address)}"`) +
        withoutAttributes(attributes, LINK_ATTRIBUTES) +
        '>';
      copied = tagEnd;
    } else if (name === 'iframe') {
      const attributes = html.slice(nameEnd, tagEnd - 1);
      const srcdoc = tagAttributes(attributes).get('srcdoc');
      if (srcdoc !== undefined) {
        const nested =
          depth < MAX_NESTED_DOCUMENTS
            ? ` srcdoc="${escapeAttribute(
                withLinksAimedAtBlank(
                  parseEntities(srcdoc, { attribute: true }),
                  depth + 1
                )
              )}"`
            : '';
        rewritten +=
          html.slice(copied, nameEnd) +
          nested +
          withoutAttributes(attributes, SRCDOC_ATTRIBUTE) +
          '>';
        copied = tagEnd;
      }
    }
    i = tagEnd;
    if (FOREIGN_ELEMENTS.has(name)) {
      if (!closesItself(html, tagEnd)) foreign += 1;
      continue;
    }
    if (foreign > 0) continue;
    if (name === 'plaintext') break;
    if (TEXT_CONTENT_ELEMENTS.has(name)) {
      const close = endTagStart(lower, name, tagEnd);
      if (close < 0) break;
      i = close;
    }
  }
  return rewritten + html.slice(copied);
}

/**
 * The file's markup as the frame loads it: the policy, `_blank` as the
 * default link target, and our link script (linkScript), ahead of the file.
 *
 * The target is the fallback for a link our script cannot see, such as one
 * inside a closed shadow root: a `_blank` link the file's frame cannot open
 * is refused outright and the preview stays as it was, where a link aimed at
 * the frame itself would be refused by the shell's `frame-src` and leave
 * Chromium's blocked-page notice behind. The first `<base>` with a target
 * wins, so a `<base href>` of the file's own still applies.
 *
 * While the file's scripts are held (`scripts: 'ours'`), the document gets
 * the held policy, under which only scripts carrying `nonce` run, and our
 * script carries it: the file is parsed by the browser as it is, and our
 * script handles its links by what the browser made of them, as when its
 * scripts run. In a frame that runs no scripts (`scripts: 'none'`, under
 * Electron) our script would be inert, so it is left out, and every link in
 * the markup is settled instead (withLinksAimedAtBlank): a link the reader
 * clicks becomes a popup, which the desktop shell opens in the system
 * browser, and only for a web, mail or phone address.
 */
export function htmlPreviewDocument(
  html: string,
  key: string,
  options:
    | { scripts?: 'all' | 'none' }
    | { scripts: 'ours'; nonce: string } = {}
): string {
  if (options.scripts === 'none') {
    return withDocumentHead(
      withLinksAimedAtBlank(html),
      `${policyMeta(HTML_PREVIEW_POLICY)}<base target="_blank">`
    );
  }
  const nonce = options.scripts === 'ours' ? options.nonce : undefined;
  const policy =
    nonce === undefined ? HTML_PREVIEW_POLICY : htmlPreviewHeldPolicy(nonce);
  return withDocumentHead(
    html,
    `${policyMeta(policy)}<base target="_blank">${linkScript(key, nonce)}`
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
