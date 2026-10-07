import {
  type DefaultTreeAdapterMap,
  Parser,
  type ParserOptions,
  type Token,
  type TokenHandler,
  Tokenizer,
  defaultTreeAdapter,
  html as htmlSpec,
} from 'parse5';

const { NS, TAG_ID } = htmlSpec;

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
 * A URL attribute's value, its character references decoded, as the URL
 * parser reads it: leading and trailing spaces and control characters
 * trimmed, tabs and newlines anywhere dropped.
 */
function urlText(url: string): string {
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

/**
 * `text` percent-decoded as a browser decodes a `javascript:` or `data:`
 * URL (and as our link script does): an escape that is not two hex digits
 * stays as written, and the escaped bytes decode as UTF-8, a malformed
 * sequence as U+FFFD.
 */
function percentDecoded(text: string): string {
  return text.replace(/(?:%[0-9A-Fa-f]{2})+/g, (run) => {
    const bytes = new Uint8Array(run.length / 3);
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = parseInt(run.slice(i * 3 + 1, i * 3 + 3), 16);
    }
    return new TextDecoder().decode(bytes);
  });
}

/** A `javascript:` URL's code: its text (urlText) after the scheme, percent-decoded. */
function javascriptCode(value: string): string {
  return percentDecoded(urlText(value).replace(URL_SCHEME, ''));
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

// How many inline frames a file may hold, at every depth, before it is
// declined. A browser builds a browsing context for each, on web on the app's
// own thread: Chromium and WebKit took 6-12 s to load a document of 1,000
// empty iframes, their most per page, and 0.3-0.5 s for 100. The preview also
// reads each `srcdoc` itself.
const MAX_INLINE_FRAMES = 100;

/**
 * The charset an HTML file declares in its first bytes, found as a browser's
 * encoding prescan finds it: comments are skipped, and only a `<meta>` with a
 * `charset` attribute, or one with `http-equiv="content-type"` whose
 * `content` names a charset, declares one. A `charset` attribute, even an
 * empty one, makes its meta that kind of declaration, so its pragma is not
 * read. `charset=` anywhere else -- in a comment, in a description -- does
 * not count, and a declaration whose label names no encoding (encodingOf) is
 * read past. The result is encodingOf's name.
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
    // An end tag is read like a start tag, attributes and all; any other
    // `<!`, `</` or `<?` runs to the first `>`, a `<meta>` in it included.
    const name =
      head.charCodeAt(open + 1) === 47 &&
      isAsciiLetter(head.charCodeAt(open + 2))
        ? open + 2
        : open + 1;
    if (!isAsciiLetter(head.charCodeAt(name))) {
      const code = head.charCodeAt(open + 1);
      if (code === 33 || code === 47 || code === 63) {
        const close = head.indexOf('>', open + 1);
        if (close < 0) return undefined;
        i = close + 1;
      } else {
        i = open + 1;
      }
      continue;
    }
    let nameEnd = name;
    while (nameEnd < head.length) {
      const code = head.charCodeAt(nameEnd);
      if (isHtmlSpace(code) || code === 47 || code === 62) break;
      nameEnd += 1;
    }
    const tagEnd = startTagEnd(head, nameEnd);
    if (tagEnd < 0) return undefined;
    i = tagEnd;
    if (
      name !== open + 1 ||
      asciiLowercase(head.slice(name, nameEnd)) !== 'meta'
    ) {
      continue;
    }
    const attributes = tagAttributes(head.slice(nameEnd, tagEnd - 1));
    const charset = attributes.get('charset');
    if (charset !== undefined) {
      const encoding = encodingOf(charset);
      if (encoding) return encoding;
      continue;
    }
    if (asciiLowercase(attributes.get('http-equiv') ?? '') === 'content-type') {
      const content = attributes.get('content');
      const value = content === undefined ? undefined : charsetIn(content);
      const encoding = value === undefined ? undefined : encodingOf(value);
      if (encoding) return encoding;
    }
  }
}

/**
 * The charset a `<meta http-equiv="content-type">`'s `content` names, read as
 * the prescan's extraction reads it: the first `charset` followed, past
 * whitespace, by `=`; then a quoted value, or one that ends at whitespace or
 * `;`. Whitespace here is ASCII whitespace and the vertical tab, which
 * Chromium and WebKit both accept around the `=` (no other space does).
 * Undefined when it names none.
 */
function charsetIn(content: string): string | undefined {
  const isSpace = (code: number) => isHtmlSpace(code) || code === 11;
  const lower = asciiLowercase(content);
  let position = 0;
  for (;;) {
    const at = lower.indexOf('charset', position);
    if (at < 0) return undefined;
    let i = at + 7;
    while (i < content.length && isSpace(content.charCodeAt(i))) i += 1;
    if (content[i] !== '=') {
      position = i;
      continue;
    }
    i += 1;
    while (i < content.length && isSpace(content.charCodeAt(i))) i += 1;
    const quote = content[i];
    if (quote === '"' || quote === "'") {
      const close = content.indexOf(quote, i + 1);
      return close < 0 ? undefined : content.slice(i + 1, close);
    }
    let end = i;
    while (
      end < content.length &&
      !isSpace(content.charCodeAt(end)) &&
      content[end] !== ';'
    ) {
      end += 1;
    }
    return end > i ? content.slice(i, end) : undefined;
  }
}

/**
 * The `charset` parameter of a Content-Type header, read as the MIME type
 * parser reads it: parameter by parameter, so a `;` or `charset=` inside a
 * quoted value is that value's, and the first `charset` wins. Undefined when
 * it has none.
 */
function mimeCharset(contentType: string): string | undefined {
  const httpSpace = (code: number) =>
    code === 9 || code === 10 || code === 13 || code === 32;
  let i = contentType.indexOf(';');
  if (i < 0) return undefined;
  while (i < contentType.length) {
    i += 1;
    while (i < contentType.length && httpSpace(contentType.charCodeAt(i))) {
      i += 1;
    }
    let nameEnd = i;
    while (
      nameEnd < contentType.length &&
      contentType[nameEnd] !== ';' &&
      contentType[nameEnd] !== '='
    ) {
      nameEnd += 1;
    }
    const name = asciiLowercase(contentType.slice(i, nameEnd));
    i = nameEnd;
    if (i >= contentType.length) return undefined;
    if (contentType[i] === ';') continue;
    i += 1;
    let value = '';
    if (contentType[i] === '"') {
      // A quoted string, where a backslash escapes the character after it.
      i += 1;
      while (i < contentType.length && contentType[i] !== '"') {
        if (contentType[i] === '\\' && i + 1 < contentType.length) i += 1;
        value += contentType[i];
        i += 1;
      }
      while (i < contentType.length && contentType[i] !== ';') i += 1;
    } else {
      let end = i;
      while (end < contentType.length && contentType[end] !== ';') end += 1;
      value = contentType.slice(i, end).replace(/[\t\n\r ]+$/, '');
      i = end;
      if (value === '') continue;
    }
    if (name === 'charset') return value;
  }
  return undefined;
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
  return encodingOf(label);
}

/**
 * The encoding a preview's bytes are in, decided as a browser decides for a
 * page: a byte order mark first, then the charset the response declares (if
 * it names an encoding), then -- for HTML -- the prescan of the first 1024
 * bytes: an XML declaration in UTF-16 bytes, a `<meta>` charset, and failing
 * that an XML declaration's encoding; UTF-8 when nothing says otherwise. The
 * result is the encoding's name in lower case (encodingOf). `head` is the
 * start of the bytes, one byte per character. A declaration that names
 * UTF-16, by any of its labels (`unicode`, `ucs-2` ...), is read as UTF-8, as
 * browsers do: ASCII cannot be found in a document that really is UTF-16; and
 * `x-user-defined` is read as windows-1252.
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
  const label = contentType ? mimeCharset(contentType) : undefined;
  const sent = label === undefined ? undefined : encodingOf(label);
  if (sent) return sent;
  if (html) {
    if (head.startsWith('<\u0000?\u0000x\u0000')) return 'utf-16le';
    if (head.startsWith('\u0000<\u0000?\u0000x')) return 'utf-16be';
    const prescan = head.slice(0, 1024);
    const declared = metaCharset(prescan) ?? xmlEncoding(prescan);
    if (declared === 'utf-16le' || declared === 'utf-16be') return 'utf-8';
    if (declared === 'x-user-defined') return 'windows-1252';
    if (declared) return declared;
  }
  return 'utf-8';
}

function latin1(bytes: Uint8Array): string {
  let text = '';
  for (let i = 0; i < bytes.length; i++) text += String.fromCharCode(bytes[i]);
  return text;
}

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

// The Encoding Standard's labels, by the encoding they name
// (https://encoding.spec.whatwg.org/encodings.json).
const ENCODING_LABELS: Record<string, string> = {
  'UTF-8':
    'unicode-1-1-utf-8 unicode11utf8 unicode20utf8 utf-8 utf8 x-unicode20utf8',
  IBM866: '866 cp866 csibm866 ibm866',
  'ISO-8859-2':
    'csisolatin2 iso-8859-2 iso-ir-101 iso8859-2 iso88592 iso_8859-2 iso_8859-2:1987 l2 latin2',
  'ISO-8859-3':
    'csisolatin3 iso-8859-3 iso-ir-109 iso8859-3 iso88593 iso_8859-3 iso_8859-3:1988 l3 latin3',
  'ISO-8859-4':
    'csisolatin4 iso-8859-4 iso-ir-110 iso8859-4 iso88594 iso_8859-4 iso_8859-4:1988 l4 latin4',
  'ISO-8859-5':
    'csisolatincyrillic cyrillic iso-8859-5 iso-ir-144 iso8859-5 iso88595 iso_8859-5 iso_8859-5:1988',
  'ISO-8859-6':
    'arabic asmo-708 csiso88596e csiso88596i csisolatinarabic ecma-114 iso-8859-6 iso-8859-6-e iso-8859-6-i iso-ir-127 iso8859-6 iso88596 iso_8859-6 iso_8859-6:1987',
  'ISO-8859-7':
    'csisolatingreek ecma-118 elot_928 greek greek8 iso-8859-7 iso-ir-126 iso8859-7 iso88597 iso_8859-7 iso_8859-7:1987 sun_eu_greek',
  'ISO-8859-8':
    'csiso88598e csisolatinhebrew hebrew iso-8859-8 iso-8859-8-e iso-ir-138 iso8859-8 iso88598 iso_8859-8 iso_8859-8:1988 visual',
  'ISO-8859-8-I': 'csiso88598i iso-8859-8-i logical',
  'ISO-8859-10':
    'csisolatin6 iso-8859-10 iso-ir-157 iso8859-10 iso885910 l6 latin6',
  'ISO-8859-13': 'iso-8859-13 iso8859-13 iso885913',
  'ISO-8859-14': 'iso-8859-14 iso8859-14 iso885914',
  'ISO-8859-15': 'csisolatin9 iso-8859-15 iso8859-15 iso885915 iso_8859-15 l9',
  'ISO-8859-16': 'iso-8859-16',
  'KOI8-R': 'cskoi8r koi koi8 koi8-r koi8_r',
  'KOI8-U': 'koi8-ru koi8-u',
  macintosh: 'csmacintosh mac macintosh x-mac-roman',
  'windows-874': 'dos-874 iso-8859-11 iso8859-11 iso885911 tis-620 windows-874',
  'windows-1250': 'cp1250 windows-1250 x-cp1250',
  'windows-1251': 'cp1251 windows-1251 x-cp1251',
  'windows-1252':
    'ansi_x3.4-1968 ascii cp1252 cp819 csisolatin1 ibm819 iso-8859-1 iso-ir-100 iso8859-1 iso88591 iso_8859-1 iso_8859-1:1987 l1 latin1 us-ascii windows-1252 x-cp1252',
  'windows-1253': 'cp1253 windows-1253 x-cp1253',
  'windows-1254':
    'cp1254 csisolatin5 iso-8859-9 iso-ir-148 iso8859-9 iso88599 iso_8859-9 iso_8859-9:1989 l5 latin5 windows-1254 x-cp1254',
  'windows-1255': 'cp1255 windows-1255 x-cp1255',
  'windows-1256': 'cp1256 windows-1256 x-cp1256',
  'windows-1257': 'cp1257 windows-1257 x-cp1257',
  'windows-1258': 'cp1258 windows-1258 x-cp1258',
  'x-mac-cyrillic': 'x-mac-cyrillic x-mac-ukrainian',
  GBK: 'chinese csgb2312 csiso58gb231280 gb2312 gb_2312 gb_2312-80 gbk iso-ir-58 x-gbk',
  gb18030: 'gb18030',
  Big5: 'big5 big5-hkscs cn-big5 csbig5 x-x-big5',
  'EUC-JP': 'cseucpkdfmtjapanese euc-jp x-euc-jp',
  'ISO-2022-JP': 'csiso2022jp iso-2022-jp',
  Shift_JIS:
    'csshiftjis ms932 ms_kanji shift-jis shift_jis sjis windows-31j x-sjis',
  'EUC-KR':
    'cseuckr csksc56011987 euc-kr iso-ir-149 korean ks_c_5601-1987 ks_c_5601-1989 ksc5601 ksc_5601 windows-949',
  replacement:
    'csiso2022kr hz-gb-2312 iso-2022-cn iso-2022-cn-ext iso-2022-kr replacement',
  'UTF-16BE': 'unicodefffe utf-16be',
  'UTF-16LE':
    'csunicode iso-10646-ucs-2 ucs-2 unicode unicodefeff utf-16 utf-16le',
  'x-user-defined': 'x-user-defined',
};

let encodingsByLabel: Map<string, string> | undefined;

/**
 * The encoding `label` names in the Encoding Standard, by its name in lower
 * case (`iso-8859-1` names `windows-1252`); undefined when it names none, and
 * then the prescan reads on past it, as a browser's does (previewEncoding).
 * Whether the runtime can decode the encoding is decodeBytes's business: a
 * label is valid or not wherever the app runs.
 */
function encodingOf(label: string): string | undefined {
  encodingsByLabel ??= new Map(
    Object.entries(ENCODING_LABELS).flatMap(([name, labels]) =>
      labels.split(' ').map((alias) => [alias, name.toLowerCase()] as const)
    )
  );
  return encodingsByLabel.get(
    asciiLowercase(label.replace(/^[\t\n\f\r ]+|[\t\n\f\r ]+$/g, ''))
  );
}

/**
 * The bytes as text in `encoding` (encodingOf's name for it), or null when
 * this runtime cannot decode it. Where the runtime's TextDecoder knows the
 * encoding, it decodes. Expo's, which React Native apps get, knows only
 * UTF-8, so windows-1252 -- the encoding of most legacy Western pages, and
 * what ISO-8859-1 means to a browser -- and UTF-16 are decoded here instead.
 * Any other there (Shift_JIS, GBK, Big5, windows-1251 ...), and the
 * replacement encoding everywhere, cannot be: read as UTF-8 it would come
 * out garbled, so the preview is declined and Open shows the file instead.
 */
function decodeBytes(bytes: Uint8Array, encoding: string): string | null {
  try {
    return new TextDecoder(encoding).decode(bytes);
  } catch {
    if (encoding === 'windows-1252') return decodeWindows1252(bytes);
    if (encoding === 'utf-16le') return decodeUtf16(bytes, true);
    if (encoding === 'utf-16be') return decodeUtf16(bytes, false);
    return null;
  }
}

/**
 * The text of a preview response, decoded in the encoding the file is in, or
 * null when the object is over the cap or in an encoding this runtime cannot
 * decode (decodeBytes).
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
  if (declared > limit) {
    // Unread, the body could keep coming over the network until the
    // response is collected.
    await response.body?.cancel().catch(() => {});
    return null;
  }

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
        await reader.cancel().catch(() => {});
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

// HTML's ASCII whitespace: tab, line feed, form feed, carriage return, space.
function isHtmlSpace(code: number): boolean {
  return code === 9 || code === 10 || code === 12 || code === 13 || code === 32;
}

function isAsciiLetter(code: number): boolean {
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

/**
 * Where a tag whose name ends at `from` ends, for the encoding prescan -- the
 * index just past its `>`, or -1 when it never ends -- and whether it closes
 * itself (`<svg/>`). It reads the attributes in the tokenizer's states: a quote opens a quoted
 * value only straight after an attribute's `=`, so one inside a name or an
 * unquoted value (`data=x="`) is just a character there; and a `/` closes
 * the tag only where it is no value's, straight before the `>` (in
 * `<svg data=x/>` it is the value's last character).
 */
function startTag(
  html: string,
  from: number
): { end: number; selfClosing: boolean } {
  let i = from;
  for (;;) {
    const between = i;
    while (
      i < html.length &&
      (isHtmlSpace(html.charCodeAt(i)) || html[i] === '/')
    ) {
      i += 1;
    }
    if (i >= html.length) return { end: -1, selfClosing: false };
    if (html[i] === '>') {
      return { end: i + 1, selfClosing: i > between && html[i - 1] === '/' };
    }
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
      if (close < 0) return { end: -1, selfClosing: false };
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

/** Where a tag whose name ends at `from` ends (startTag). */
function startTagEnd(html: string, from: number): number {
  return startTag(html, from).end;
}

// The parse5 tree, and what the preview reads of it.
type ParsedDocument = DefaultTreeAdapterMap['document'];
type ParsedNode = DefaultTreeAdapterMap['node'];
type ParsedElement = DefaultTreeAdapterMap['element'];

// How deep the parser may nest elements before a file is declined. The tree
// builder rescans its stack of open elements for many tokens, so the time a
// file of nested elements takes grows with the square of its depth: parse5
// spent minutes on a megabyte of nested divs. Real pages nest a few dozen
// deep; at this cap a crafted 2 MB file parses in about a second.
const MAX_PARSE_DEPTH = 128;

// How many elements the parser may build for one document before its file is
// declined. The tree is kept while the preview is open, beside the browser's
// own DOM: a 2 MB file of bare <p>s built 700,000 elements in 1.8 s and kept
// 250 MB in parse5. A dense 2 MB data table builds about 150,000.
const MAX_PARSE_ELEMENTS = 200_000;

// How many attributes one tag, and one document in all, may carry before its
// file is declined. parse5 checks each attribute against every one before it
// on the same tag, so a tag's time grows with the square of its count: it
// took 19 s on one tag of 100,000 (0.55 MB), which Chromium and WebKit read
// in 0.1 s. Real tags carry a few dozen.
const MAX_TAG_ATTRIBUTES = 256;
const MAX_PARSE_ATTRIBUTES = 400_000;

class ParseLimit extends Error {}

let elementsLeft = 0;
let attributesLeft = 0;

/** parse5's tokenizer, stopping the parse past MAX_TAG_ATTRIBUTES or MAX_PARSE_ATTRIBUTES. */
class CappedTokenizer extends Tokenizer {
  protected override _createAttr(attrNameFirstCh: string): void {
    attributesLeft -= 1;
    const tag = this.currentToken as Token.TagToken;
    if (attributesLeft < 0 || tag.attrs.length >= MAX_TAG_ATTRIBUTES) {
      throw new ParseLimit();
    }
    super._createAttr(attrNameFirstCh);
  }
}

/**
 * parse5's parser, with CappedTokenizer, resetting its insertion mode by HTML
 * elements alone, as the standard does. parse5 takes a foreign element with
 * an HTML element's name (an SVG `<template>`) on its stack for the HTML one
 * and drops what follows -- a script after an HTML template closed inside an
 * SVG template's foreignObject, which Chromium and WebKit run.
 */
class PreviewParser extends Parser<DefaultTreeAdapterMap> {
  constructor(options?: ParserOptions<DefaultTreeAdapterMap>) {
    super(options);
    this.tokenizer = new CappedTokenizer(this.options, this);
  }

  override _resetInsertionMode(): void {
    const { items, stackTop, tagIDs } = this.openElements;
    const foreign: number[] = [];
    for (let i = 0; i <= stackTop; i++) {
      const item = items[i];
      if (
        this.treeAdapter.isElementNode(item) &&
        this.treeAdapter.getNamespaceURI(item) !== NS.HTML
      ) {
        foreign.push(i);
      }
    }
    const ids = foreign.map((i) => tagIDs[i]);
    for (const i of foreign) tagIDs[i] = TAG_ID.UNKNOWN;
    try {
      super._resetInsertionMode();
    } finally {
      foreign.forEach((i, n) => (tagIDs[i] = ids[n]));
    }
  }
}

const DEPTH = Symbol('depth');
type Nested = { [DEPTH]?: number };

// The order the parser made elements in, which is the order it inserted them
// in: a table's misplaced content lands ahead of it in the tree, but later.
const CREATED = Symbol('created');
let created = 0;

/** When the parser made `element`, against the others it made. */
function createdAt(element: ParsedElement): number {
  return (element as { [CREATED]?: number })[CREATED] ?? 0;
}

/**
 * Records a node's depth as the parser attaches it, and stops the parse past
 * MAX_PARSE_DEPTH or MAX_PARSE_ELEMENTS. Text and comments are attached
 * without it, inside the elements it counts.
 */
function attach(parent: ParsedNode, child: ParsedNode): void {
  const depth = ((parent as Nested)[DEPTH] ?? 0) + 1;
  elementsLeft -= 1;
  if (depth > MAX_PARSE_DEPTH || elementsLeft < 0) throw new ParseLimit();
  (child as Nested)[DEPTH] = depth;
  // A template's content is a fragment of its own, holding what nests in it.
  if ('content' in child) (child.content as Nested)[DEPTH] = depth;
}

const depthCappedTreeAdapter: typeof defaultTreeAdapter = {
  ...defaultTreeAdapter,
  createElement(tagName, namespaceURI, attrs) {
    const element = defaultTreeAdapter.createElement(
      tagName,
      namespaceURI,
      attrs
    );
    (element as { [CREATED]?: number })[CREATED] = ++created;
    return element;
  },
  appendChild(parent, child) {
    attach(parent, child);
    defaultTreeAdapter.appendChild(parent, child);
  },
  insertBefore(parent, child, reference) {
    attach(parent, child);
    defaultTreeAdapter.insertBefore(parent, child, reference);
  },
};

/** A file's tree, and how far its source offsets lie from the file's. */
interface ParsedHtml {
  document: ParsedDocument;
  offset: number;
}

/**
 * `html` as a browser's parser builds it, with scripting on or off, which
 * decides whether a `<noscript>` holds text or markup (PreviewParser); null
 * when it nests past MAX_PARSE_DEPTH, builds more than MAX_PARSE_ELEMENTS or
 * carries more attributes than MAX_TAG_ATTRIBUTES or MAX_PARSE_ATTRIBUTES. A leading
 * byte order mark is skipped, as Chromium and WebKit skip one in a srcdoc
 * document, so the tree's source offsets lie one short of `html`'s. Only a
 * tree read as a frame without scripts has source offsets: they are read to
 * rewrite its markup (withLinksAimedAtBlank), and they double a tree's size.
 */
function parseHtml(html: string, scripting: boolean): ParsedHtml | null {
  const offset = html.charCodeAt(0) === 0xfeff ? 1 : 0;
  elementsLeft = MAX_PARSE_ELEMENTS;
  attributesLeft = MAX_PARSE_ATTRIBUTES;
  try {
    const document = PreviewParser.parse(offset ? html.slice(1) : html, {
      scriptingEnabled: scripting,
      sourceCodeLocationInfo: !scripting,
      treeAdapter: depthCappedTreeAdapter,
    });
    return { document, offset };
  } catch (error) {
    if (error instanceof ParseLimit) return null;
    throw error;
  }
}

// The last file parsed: the viewer asks whether it can read a file on every
// render, and reads its title, its scripts and its markup in turn, each from
// the same tree, which it lets go of once it closes (releaseHtmlPreview).
let lastParsed:
  | {
      html: string;
      scripting: boolean;
      parsed: ParsedHtml | null;
      readable?: boolean;
    }
  | undefined;

/** The file read last, parsed (parseHtml). */
function lastParsedOf(html: string, scripting: boolean) {
  if (lastParsed?.html !== html || lastParsed.scripting !== scripting) {
    lastParsed = { html, scripting, parsed: parseHtml(html, scripting) };
  }
  return lastParsed;
}

/** parseHtml, kept for the file read last. */
function parsedHtml(html: string, scripting: boolean): ParsedHtml | null {
  return lastParsedOf(html, scripting).parsed;
}

/**
 * Lets go of the file read last and its tree, which can hold tens of
 * megabytes; the viewer calls it when it closes.
 */
export function releaseHtmlPreview(): void {
  lastParsed = undefined;
}

/**
 * The elements under `root` in tree order. A template's content is entered
 * only where `entersTemplate` says so: an ordinary template's is inert.
 */
function* elementsOf(
  root: ParsedNode,
  entersTemplate: (template: ParsedElement) => boolean
): Generator<ParsedElement> {
  const pending: ParsedNode[] = [root];
  while (pending.length > 0) {
    const node = pending.pop()!;
    let children: ParsedNode[] = 'childNodes' in node ? node.childNodes : [];
    if (defaultTreeAdapter.isElementNode(node)) {
      yield node;
      if ('content' in node && entersTemplate(node)) {
        children = node.content.childNodes;
      }
    }
    for (let i = children.length - 1; i >= 0; i -= 1) pending.push(children[i]);
  }
}

/** The value of `element`'s attribute `name`, in `namespace` when given. */
function attributeOf(
  element: ParsedElement,
  name: string,
  namespace?: string
): string | undefined {
  return element.attrs.find(
    (attribute) => attribute.name === name && attribute.namespace === namespace
  )?.value;
}

/**
 * Whether the preview can read an HTML file: false when it, or the document
 * of an inline frame in it, nests elements deeper than MAX_PARSE_DEPTH, which
 * no real page does, or holds more than MAX_PARSE_ELEMENTS, which only the
 * densest 2 MB pages near, or when it holds more than MAX_INLINE_FRAMES
 * inline frames, or nests one `srcdoc` in another deeper than
 * MAX_NESTED_DOCUMENTS, which are not read; the viewer offers Open instead.
 * The file is read as a frame that runs scripts, or one that does not
 * (`scripting: false`, under Electron), reads it.
 */
export function htmlPreviewReadable(
  html: string,
  { scripting = true }: { scripting?: boolean } = {}
): boolean {
  const read = lastParsedOf(html, scripting);
  read.readable ??=
    read.parsed !== null && framesReadable(read.parsed.document, scripting);
  return read.readable;
}

/**
 * Whether an iframe's own `sandbox` lets its document run scripts: none set,
 * or one allowing them. A document it keeps from scripts runs none, nor does
 * any frame inside it, whatever that frame's own sandbox says.
 */
function frameRunsScripts(iframe: ParsedElement): boolean {
  const sandbox = attributeOf(iframe, 'sandbox');
  return (
    sandbox === undefined ||
    asciiLowercase(sandbox)
      .split(/[\t\n\f\r ]/)
      .includes('allow-scripts')
  );
}

/**
 * Whether the `srcdoc` documents in `document` read: the browser parses each
 * itself, and is as slow as the parser on markup nested past MAX_PARSE_DEPTH
 * -- Chromium and WebKit each took over a minute on a megabyte of nested
 * divs, on web on the app's own thread. An inline frame in an ordinary
 * template never loads; every other frame counts against MAX_INLINE_FRAMES
 * (`frames`, shared by the whole walk). Each document is read as its frame
 * reads it, which runs scripts only where the frame around it does and its
 * own sandbox allows them (frameRunsScripts).
 */
function framesReadable(
  document: ParsedDocument,
  scripting: boolean,
  depth = 0,
  frames = { left: MAX_INLINE_FRAMES }
): boolean {
  for (const element of elementsOf(document, shadowRootsAttached())) {
    if (
      (element.nodeName !== 'iframe' && element.nodeName !== 'frame') ||
      element.namespaceURI !== NS.HTML
    ) {
      continue;
    }
    frames.left -= 1;
    if (frames.left < 0) return false;
    const srcdoc =
      element.nodeName === 'iframe'
        ? attributeOf(element, 'srcdoc')
        : undefined;
    if (srcdoc === undefined) continue;
    if (depth >= MAX_NESTED_DOCUMENTS) return false;
    const frameScripting = scripting && frameRunsScripts(element);
    const nested = parseHtml(srcdoc, frameScripting);
    if (
      !nested ||
      !framesReadable(nested.document, frameScripting, depth + 1, frames)
    ) {
      return false;
    }
  }
  return true;
}

/**
 * The title of an HTML file, as the page itself would show it: the first
 * `<title>` the parser makes the document's -- not one in a template, nor an
 * `<svg>`'s own, which is a tooltip -- its text with ASCII whitespace
 * collapsed, the way `document.title` reads it. Undefined when the file has
 * none, it is blank, or the file cannot be read (htmlPreviewReadable). In a
 * frame that runs no scripts (`scripting: false`, under Electron), a
 * `<noscript>` holds markup, and a title in it counts.
 */
export function htmlPreviewTitle(
  html: string,
  { scripting = true }: { scripting?: boolean } = {}
): string | undefined {
  const parsed = parsedHtml(html, scripting);
  if (!parsed || !htmlPreviewReadable(html, { scripting })) return undefined;
  for (const element of elementsOf(parsed.document, () => false)) {
    if (element.nodeName !== 'title' || element.namespaceURI !== NS.HTML) {
      continue;
    }
    const title = element.childNodes
      .map((node) => (defaultTreeAdapter.isTextNode(node) ? node.value : ''))
      .join('')
      .replace(/[\t\n\f\r ]+/g, ' ')
      .replace(/^ | $/g, '');
    return title === '' ? undefined : title.slice(0, 200);
  }
  return undefined;
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
 * Whose scripts a preview runs: the file's and ours (`all`: once the reader
 * asks), ours alone (`ours`: on web, iOS and Android until then), or none
 * (`none`: under Electron). A file's script waits for the reader everywhere
 * it can run (BucketFileViewer): on web it runs on the app's own thread,
 * where a loop that never ends would freeze the whole tab; on iOS and
 * Android it can post to the WebView's message bridge as often as it likes,
 * and every message reaches the app's JavaScript thread before the token is
 * checked.
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

// HTML's JavaScript MIME types: a script element of one of these types runs
// as a classic script.
const JAVASCRIPT_MIME_TYPES = new Set([
  'application/ecmascript',
  'application/javascript',
  'application/x-ecmascript',
  'application/x-javascript',
  'text/ecmascript',
  'text/javascript',
  'text/javascript1.0',
  'text/javascript1.1',
  'text/javascript1.2',
  'text/javascript1.3',
  'text/javascript1.4',
  'text/javascript1.5',
  'text/jscript',
  'text/livescript',
  'text/x-ecmascript',
  'text/x-javascript',
]);

/**
 * What a browser prepares a script element as: a classic script, a module,
 * or data it never runs.
 * Without a type an HTML script's language names one (`text/` and the
 * language), and with neither it is JavaScript, as an SVG script without a
 * type always is: Chromium and WebKit ignore its language. An empty type is
 * JavaScript; any other type, trimmed, must be exactly a JavaScript MIME type
 * (a `charset` parameter makes it data) or `module`. JSON-LD, `text/plain`, a
 * template, an import map or speculation rules never run. Chromium also trims
 * a vertical tab from the type.
 */
function scriptKind(script: ParsedElement): 'classic' | 'module' | undefined {
  const value = attributeOf(script, 'type');
  if (value === undefined) {
    const language =
      script.namespaceURI === NS.HTML
        ? attributeOf(script, 'language')
        : undefined;
    if (language === undefined) return 'classic';
    return language === '' ||
      JAVASCRIPT_MIME_TYPES.has(`text/${asciiLowercase(language)}`)
      ? 'classic'
      : undefined;
  }
  if (value === '') return 'classic';
  const isSpace = (code: number) => isHtmlSpace(code) || code === 11;
  let start = 0;
  let end = value.length;
  while (start < end && isSpace(value.charCodeAt(start))) start += 1;
  while (end > start && isSpace(value.charCodeAt(end - 1))) end -= 1;
  const essence = asciiLowercase(value.slice(start, end));
  if (JAVASCRIPT_MIME_TYPES.has(essence)) return 'classic';
  return essence === 'module' ? 'module' : undefined;
}

// The events an `on<event>` content attribute handles on every HTML, SVG and
// MathML element in Chromium or WebKit, as measured by setting each on every
// kind of element, with the ones only their sources show: WebKit's legacy
// table (iOS's gesture and video fullscreen events among them) and Chromium's
// attribute table, which is ahead of the Chromium the tests run. Some more
// are handled only on certain elements (handlesEvent), and any other
// attribute starting with `on` (`only`, `onward`) is data.
const HANDLED_EVENTS = new Set(
  `
  abort animationcancel animationend animationiteration animationstart
  autocomplete autocompleteerror auxclick beforecopy beforecut beforefilter
  beforeinput beforeload beforematch beforepaste beforetoggle beforexrselect
  blur cancel canplay canplaythrough change click close command
  contentvisibilityautostatechange contextlost contextmenu contextrestored
  copy cuechange cut dblclick drag dragend dragenter dragleave dragover
  dragstart drop durationchange emptied ended error focus focusin focusout
  formdata fullscreenchange fullscreenerror gesturechange gestureend
  gesturestart gotpointercapture input installresult invalid keydown
  keypress keyup load loadeddata loadedmetadata loadstart location
  lostpointercapture mousedown mouseenter mouseleave mousemove mouseout
  mouseover mouseup mousewheel paste pause play playing pointercancel
  pointerdown pointerenter pointerleave pointermove pointerout pointerover
  pointerrawupdate pointerup progress promptaction promptdismiss ratechange
  reset resize scroll scrollend scrollsnapchange scrollsnapchanging
  securitypolicyviolation seeked seeking select selectionchange selectstart
  slotchange stalled stream submit suspend timeupdate toggle touchcancel
  touchend touchforcechange touchmove touchstart transitioncancel
  transitionend transitionrun transitionstart validationstatuschange
  volumechange waiting webkitanimationend webkitanimationiteration
  webkitanimationstart webkitbeginfullscreen
  webkitcurrentplaybacktargetiswirelesschanged webkitendfullscreen
  webkitfullscreenchange webkitfullscreenerror webkitkeyadded webkitkeyerror
  webkitkeymessage webkitmouseforcechanged webkitmouseforcedown
  webkitmouseforceup webkitmouseforcewillbegin webkitneedkey
  webkitplaybacktargetavailabilitychanged webkitpresentationmodechanged
  webkittransitionend wheel
`
    .trim()
    .split(/\s+/)
);

// The window's events, which <body> and <frameset> take on its behalf, as an
// <svg> takes unload; the media elements' that neither engine maps from
// markup (measured) but their interfaces name; and Chromium's SVG animation
// events.
const WINDOW_EVENTS = new Set(
  `
  afterprint beforeprint beforeunload gamepadconnected gamepaddisconnected
  hashchange languagechange message messageerror offline online
  orientationchange pagehide pagereveal pageshow pageswap popstate
  rejectionhandled storage unhandledrejection unload
`
    .trim()
    .split(/\s+/)
);
const MEDIA_EVENTS = new Set([
  'encrypted',
  'enterpictureinpicture',
  'leavepictureinpicture',
  'waitingforkey',
]);
const SVG_ANIMATION_EVENTS = new Set(['begin', 'end', 'repeat']);
const SVG_ANIMATION_ELEMENTS = new Set([
  'animate',
  'animateMotion',
  'animateTransform',
  'set',
]);

/** Whether an `on<event>` content attribute is a handler on `element` in Chromium or WebKit. */
function handlesEvent(element: ParsedElement, event: string): boolean {
  if (HANDLED_EVENTS.has(event)) return true;
  const name = element.nodeName;
  if (element.namespaceURI === NS.HTML) {
    if (name === 'body' || name === 'frameset') return WINDOW_EVENTS.has(event);
    if (name === 'audio' || name === 'video') return MEDIA_EVENTS.has(event);
    return name === 'input' && event === 'search';
  }
  if (element.namespaceURI !== NS.SVG) return false;
  return name === 'svg'
    ? event === 'unload'
    : SVG_ANIMATION_ELEMENTS.has(name) && SVG_ANIMATION_EVENTS.has(event);
}

/**
 * Whether a browser would run a `javascript:` URL in this attribute of this
 * element, as measured in a preview running the page's scripts: a link the
 * reader follows -- an HTML link's href, an SVG link's href or xlink:href, a
 * MathML element's href (WebKit) -- or an inline frame's src (Chromium). A
 * form cannot submit and an object or embed cannot load in a preview, and
 * any other URL is fetched, never run.
 */
function runsJavascriptUrl(
  element: ParsedElement,
  attribute: Token.Attribute
): boolean {
  switch (element.namespaceURI) {
    case NS.MATHML:
      return attribute.name === 'href' && attribute.namespace === undefined;
    case NS.SVG:
      return (
        element.nodeName === 'a' &&
        attribute.name === 'href' &&
        (attribute.namespace === undefined || attribute.namespace === NS.XLINK)
      );
    case NS.HTML:
      if (attribute.namespace !== undefined) return false;
      return attribute.name === 'href'
        ? element.nodeName === 'a' || element.nodeName === 'area'
        : attribute.name === 'src' &&
            (element.nodeName === 'iframe' || element.nodeName === 'frame');
    default:
      return false;
  }
}

// The HTML elements a shadow root may attach to, besides custom elements; the
// names a custom element may take (a lowercase ASCII letter, then the
// standard's PCENChar, with a hyphen among them), as Chromium and WebKit
// measured, which is how the parser left them (ASCII lowercased); and the
// hyphenated names a custom element may not take.
const CUSTOM_ELEMENT_NAME =
  /^[a-z][-.0-9_a-z\u00b7\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u037d\u037f-\u1fff\u200c-\u200d\u203f\u2040\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd\u{10000}-\u{effff}]*$/u;
const SHADOW_HOSTS = new Set([
  'article',
  'aside',
  'blockquote',
  'body',
  'div',
  'footer',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'main',
  'nav',
  'p',
  'section',
  'span',
]);
const RESERVED_CUSTOM_ELEMENT_NAMES = new Set([
  'annotation-xml',
  'color-profile',
  'font-face',
  'font-face-format',
  'font-face-name',
  'font-face-src',
  'font-face-uri',
  'missing-glyph',
]);

/** Whether a template asks to be a declarative shadow root (`shadowrootmode` open or closed). */
function declaresShadowRoot(template: ParsedElement): boolean {
  if (template.namespaceURI !== NS.HTML) return false;
  const mode = asciiLowercase(attributeOf(template, 'shadowrootmode') ?? '');
  return mode === 'open' || mode === 'closed';
}

/**
 * A test, for one walk of a tree in order, of whether the parser makes a
 * template a declarative shadow root, whose content is live, rather than an
 * ordinary template, whose content is inert: it must ask to be one, on an
 * HTML element that can host one, and be the first to ask on it -- a host
 * keeps its first shadow root, and a later template stays a template.
 */
function shadowRootsAttached(): (template: ParsedElement) => boolean {
  const hosts = new Set<ParsedNode>();
  return (template) => {
    if (!declaresShadowRoot(template)) return false;
    const host = template.parentNode;
    if (
      !host ||
      !defaultTreeAdapter.isElementNode(host) ||
      host.namespaceURI !== NS.HTML ||
      hosts.has(host)
    ) {
      return false;
    }
    const name = host.nodeName;
    const canHost =
      SHADOW_HOSTS.has(name) ||
      (CUSTOM_ELEMENT_NAME.test(name) &&
        name.includes('-') &&
        !RESERVED_CUSTOM_ELEMENT_NAMES.has(name));
    if (canHost) hosts.add(host);
    return canHost;
  };
}

/**
 * The parts of a file's own `Content-Security-Policy` that decide whether its
 * scripts run: the source lists for script elements (script-src-elem, else
 * script-src, else default-src), for event handlers (script-src-attr, else
 * the same) and for eval (script-src, else default-src), undefined where the
 * policy sets none. Chromium and WebKit enforce it beside the preview's own
 * from where the parser reaches its `<meta>`, which counts only in `<head>`,
 * and an inline frame's document inherits it.
 */
interface AuthoredPolicy {
  elements?: string[];
  attributes?: string[];
  evaluation?: string[];
  bases?: string[];
}

// The checks against a file's own policies one read may make (each check
// costing the policies in force, by their sources), past which the file's
// code is taken to run.
const MAX_POLICY_CHECKS = 1_000_000;

/** What one check against a policy costs: one, and one per source it names. */
function policyCost(policy: AuthoredPolicy): number {
  return (
    1 +
    (policy.elements?.length ?? 0) +
    (policy.attributes?.length ?? 0) +
    (policy.evaluation?.length ?? 0)
  );
}

/**
 * Whether a script element loads from `url`: the preview's policy allows it
 * (scriptSource), and so does every policy of the file's own in force
 * (`allow`).
 */
function externalRuns(
  url: URL | undefined,
  script: ParsedElement,
  allow: (allows: (policy: AuthoredPolicy) => boolean) => boolean
): boolean {
  const nonce = attributeOf(script, 'nonce');
  const integrity = attributeOf(script, 'integrity') !== undefined;
  return (
    url !== undefined &&
    allow((p) => allowsExternal(p.elements, url, nonce, integrity))
  );
}

/** The policy a `<meta http-equiv="Content-Security-Policy">` in `<head>` sets, if `element` is one. */
function authoredPolicy(element: ParsedElement): AuthoredPolicy | undefined {
  const head = element.parentNode;
  if (
    element.nodeName !== 'meta' ||
    element.namespaceURI !== NS.HTML ||
    !head ||
    !defaultTreeAdapter.isElementNode(head) ||
    head.nodeName !== 'head' ||
    head.namespaceURI !== NS.HTML ||
    asciiLowercase(attributeOf(element, 'http-equiv') ?? '') !==
      'content-security-policy'
  ) {
    return undefined;
  }
  const content = attributeOf(element, 'content');
  if (content === undefined) return undefined;
  const directives = new Map<string, string[]>();
  for (const directive of content.split(';')) {
    const [name, ...sources] = directive
      .split(/[\t\n\f\r ]+/)
      .filter((token) => token !== '');
    if (name !== undefined && !directives.has(asciiLowercase(name))) {
      directives.set(asciiLowercase(name), sources);
    }
  }
  const scripts = directives.get('script-src') ?? directives.get('default-src');
  return {
    elements: directives.get('script-src-elem') ?? scripts,
    attributes: directives.get('script-src-attr') ?? scripts,
    evaluation: scripts,
    bases: directives.get('base-uri'),
  };
}

/**
 * The base an element resolves addresses against: the base set when the
 * parser made it (baseReached), or `inherited` without one -- or where a
 * `base-uri` the file's own policies had set by the time the parser made the
 * base refuses its address in both engines, as with 'none'.
 */
function baseResolver(
  document: ParsedDocument,
  inherited: string | undefined,
  inheritedPolicies: AuthoredPolicy[]
): (element: ParsedElement | undefined) => string | undefined {
  const bases = baseElements(document);
  const reached = baseReached(bases);
  let authored: { at: number; policy: AuthoredPolicy }[] | undefined;
  // Each base is judged once, however many elements resolve against it.
  const judged = new Map<ParsedElement, string | undefined>();
  return (element) => {
    const base = element === undefined ? bases[0] : reached(element);
    if (base !== undefined && judged.has(base)) return judged.get(base);
    const address = webBase(base, inherited);
    if (base === undefined || address === undefined || address === inherited) {
      if (base !== undefined) judged.set(base, address);
      return address;
    }
    authored ??= [...elementsOf(document, () => false)].flatMap((meta) => {
      const policy = authoredPolicy(meta);
      return policy ? [{ at: createdAt(meta), policy }] : [];
    });
    const url = new URL(address);
    const refused = [
      ...inheritedPolicies,
      ...authored.filter(({ at }) => at < createdAt(base)).map((a) => a.policy),
    ].some(
      ({ bases: list }) =>
        list !== undefined &&
        (allowsNothing(list) ||
          !list.some((source) => sourceMatches(source, url)))
    );
    judged.set(base, refused ? inherited : address);
    return judged.get(base);
  };
}

/** A script element's own text, which a browser runs when it has no address; with none but whitespace, nothing happens. */
function scriptText(script: ParsedElement): string {
  return script.childNodes
    .map((node) => (defaultTreeAdapter.isTextNode(node) ? node.value : ''))
    .join('');
}

/** Whether a source list names nothing: empty, or `'none'` alone. */
function allowsNothing(list: string[] | undefined): boolean {
  return (
    list !== undefined &&
    (list.length === 0 ||
      (list.length === 1 && asciiLowercase(list[0]) === "'none'"))
  );
}

// A nonce source: `'nonce-` (in any case), a base64 value, and `'`.
const NONCE_SOURCE = /^'nonce-([A-Za-z0-9+/_-]+={0,2})'$/i;

/**
 * Whether a source list lets inline code run (`nonce` an element's): a
 * matching nonce, or 'unsafe-inline' where no nonce source, hash source or
 * 'strict-dynamic' overrides it. A hash might match the code, which is not
 * hashed here, so a list with one is taken to.
 */
function allowsInline(list: string[] | undefined, nonce?: string): boolean {
  if (list === undefined) return true;
  if (allowsNothing(list)) return false;
  const lower = list.map(asciiLowercase);
  if (lower.some((source) => /^'sha(256|384|512)-/.test(source))) return true;
  const nonces = nonceValues(list);
  if (nonce !== undefined && nonces.includes(nonce)) return true;
  return (
    lower.includes("'unsafe-inline'") &&
    !lower.includes("'strict-dynamic'") &&
    nonces.length === 0
  );
}

/**
 * The nonces a source list names: only nonce sources in the standard's
 * grammar count; one that is not, such as `'nonce-'`, is ignored, by
 * Chromium and WebKit alike.
 */
function nonceValues(list: string[]): string[] {
  return list
    .map((source) => NONCE_SOURCE.exec(source)?.[1])
    .filter((value) => value !== undefined);
}

/**
 * Whether a source list lets a script load from `url` in Chromium or
 * WebKit, where they differ:
 * a nonce the script carries; under 'strict-dynamic' nothing else, but a hash
 * its integrity check might match; otherwise a source expression matching
 * the address in either engine (sourceMatches). A script it lets load in one
 * engine counts, so the reader can enable it there.
 */
function allowsExternal(
  list: string[] | undefined,
  url: URL,
  nonce: string | undefined,
  integrity: boolean
): boolean {
  if (list === undefined) return true;
  if (allowsNothing(list)) return false;
  if (nonce !== undefined && nonceValues(list).includes(nonce)) return true;
  const lower = list.map(asciiLowercase);
  if (integrity && lower.some((source) => /^'sha(256|384|512)-/.test(source))) {
    return true;
  }
  if (lower.includes("'strict-dynamic'")) return false;
  return list.some((source) => sourceMatches(source, url));
}

// A host source: an optional scheme, a host (or `*.` and a host), an
// optional port and an optional path.
const HOST_SOURCE =
  /^(?:([a-z][a-z0-9+.-]*):\/\/)?(\*|(?:\*\.)?[^/:?#*]+)(?::(\d+|\*))?(\/[^?#]*)?$/i;

/**
 * Whether one source expression matches a script address the preview's
 * policy allows (`data:`, or https from a CDN) in Chromium or WebKit,
 * as both were measured: `*` matches web addresses; a scheme its own and,
 * upgraded, `http:` an https one; 'self' an https one (WebKit, from a
 * srcdoc document); a host source an https address on that host (or under
 * `*.` it, below), with or without a scheme, on its default port or one the
 * source names (443 or `*`), and under its path -- a prefix ending in `/`, or
 * else the whole path, case and all.
 */
function sourceMatches(source: string, url: URL): boolean {
  const lower = asciiLowercase(source);
  const scheme = url.protocol.slice(0, -1);
  if (lower === "'self'") return scheme === 'https';
  if (lower === '*') return scheme === 'https';
  if (/^[a-z][a-z0-9+.-]*:$/.test(lower)) {
    const named = lower.slice(0, -1);
    return named === scheme || (named === 'http' && scheme === 'https');
  }
  const host = HOST_SOURCE.exec(source);
  if (scheme !== 'https' || !host || lower.startsWith("'")) return false;
  const [, sourceScheme, sourceHost, port, path] = host;
  if (
    sourceScheme !== undefined &&
    !['http', 'https'].includes(asciiLowercase(sourceScheme))
  ) {
    return false;
  }
  const name = asciiLowercase(sourceHost);
  const hostMatches =
    name === '*' ||
    (name.startsWith('*.')
      ? url.hostname.endsWith(name.slice(1))
      : url.hostname === name);
  const portMatches =
    port === undefined ||
    port === '*' ||
    port === '443' ||
    (port === '80' && asciiLowercase(sourceScheme ?? '') === 'http');
  if (!hostMatches || !portMatches) return false;
  if (path === undefined || path === '') return true;
  // Both engines decode the whole path before comparing: a source path's
  // escaped slash matches a real one (measured).
  try {
    const want = decodeURIComponent(path);
    const have = decodeURIComponent(url.pathname);
    return want.endsWith('/') ? have.startsWith(want) : have === want;
  } catch {
    return true;
  }
}

/** Whether a source list lets code run through eval: 'unsafe-eval'. */
function allowsEvaluation(list: string[] | undefined): boolean {
  return (
    list === undefined || list.map(asciiLowercase).includes("'unsafe-eval'")
  );
}

/**
 * Whether an HTML file has anything a script would run from: an HTML or SVG
 * script element that runs code (scriptKind; a classic HTML one marked
 * `nomodule` is skipped by every browser that runs modules, a MathML one is
 * never run, and one with an address runs only from where the policy lets it
 * load (scriptSource, and the file's own policy: allowsExternal), against the base the document has or, for a
 * `srcdoc` one, `inherited`), an event handler attribute (handlesEvent), a
 * `javascript:` URL where a browser runs one (runsJavascriptUrl), or any of
 * these in the `srcdoc` of an HTML iframe whose sandbox lets it run scripts
 * (frameRunsScripts) -- outside an ordinary template, whose content is inert,
 * though inside a declarative shadow root. A page without any renders the
 * same with scripts off, so there is nothing to run. A `srcdoc` nested deeper
 * than MAX_NESTED_DOCUMENTS, or deeper than the parser reads, is taken to have
 * some, and a file itself nesting deeper than the parser reads offers nothing
 * to run; the preview reads neither file (htmlPreviewReadable).
 *
 * Each document is read as a frame that runs scripts reads it, and a select
 * as WebKit and Electron's Chromium read it, holding scripts but dropping
 * most other tags.
 */
export function htmlPreviewHasScripts(
  html: string,
  depth = 0,
  inherited?: string,
  inheritedPolicies: AuthoredPolicy[] = [],
  budget = { checks: MAX_POLICY_CHECKS }
): boolean {
  const parsed = depth === 0 ? parsedHtml(html, true) : parseHtml(html, true);
  if (!parsed) return depth > 0;
  // An element resolves addresses against the base set when the parser made
  // it, and the file's own policies apply from where they stand.
  const baseFor = baseResolver(parsed.document, inherited, inheritedPolicies);
  const policies = [...inheritedPolicies];
  let cost = policies.reduce((sum, p) => sum + policyCost(p), 0);
  // Whether every policy in force allows something. A file can pit thousands
  // of its own policies against tens of thousands of elements, so the checks
  // draw on a budget shared by the whole read; past it, code counts.
  const allow = (allows: (policy: AuthoredPolicy) => boolean): boolean => {
    budget.checks -= cost;
    return budget.checks < 0 || policies.every(allows);
  };
  for (const element of elementsOf(parsed.document, shadowRootsAttached())) {
    const policy = authoredPolicy(element);
    if (policy) {
      policies.push(policy);
      cost += policyCost(policy);
    }
    if (element.nodeName === 'script' && element.namespaceURI !== NS.MATHML) {
      const kind = scriptKind(element);
      // An SVG script's address is its href, or else its xlink:href.
      const src =
        element.namespaceURI === NS.SVG
          ? (attributeOf(element, 'href') ??
            attributeOf(element, 'href', NS.XLINK))
          : attributeOf(element, 'src');
      const nonce = attributeOf(element, 'nonce');
      if (
        (kind === 'module' ||
          (kind === 'classic' &&
            (element.namespaceURI === NS.SVG ||
              attributeOf(element, 'nomodule') === undefined))) &&
        (src === undefined
          ? scriptText(element).trim() !== '' &&
            allow((p) => allowsInline(p.elements, nonce))
          : externalRuns(
              scriptSource(src, baseFor(element), kind === 'module'),
              element,
              allow
            ))
      ) {
        return true;
      }
    }
    for (const attribute of element.attrs) {
      if (
        attribute.namespace === undefined &&
        attribute.name.startsWith('on') &&
        handlesEvent(element, attribute.name.slice(2)) &&
        attribute.value.trim() !== '' &&
        allow((p) => allowsInline(p.attributes))
      ) {
        return true;
      }
      // Our link script runs an HTML or SVG link's javascript: by eval;
      // WebKit runs a MathML element's, and Chromium a frame's, itself, as
      // inline code.
      if (
        runsJavascriptUrl(element, attribute) &&
        urlScheme(attribute.value) === 'javascript' &&
        javascriptCode(attribute.value).trim() !== '' &&
        // An iframe runs its javascript: source only without a sandbox of
        // its own, even one allowing scripts (Chromium; WebKit runs none); a
        // <frame> has no sandbox attribute, so one on it does nothing.
        !(
          element.nodeName === 'iframe' &&
          attributeOf(element, 'sandbox') !== undefined
        ) &&
        // Nor does a frame of either kind with a srcdoc beside it, even an
        // empty one (Chromium, measured): an iframe loads the srcdoc instead.
        !(
          attribute.name === 'src' &&
          attributeOf(element, 'srcdoc') !== undefined
        ) &&
        allow((p) =>
          (element.nodeName === 'a' || element.nodeName === 'area') &&
          element.namespaceURI !== NS.MATHML
            ? allowsEvaluation(p.evaluation)
            : allowsInline(p.elements)
        )
      ) {
        return true;
      }
    }
    const srcdoc =
      element.nodeName === 'iframe' && element.namespaceURI === NS.HTML
        ? attributeOf(element, 'srcdoc')
        : undefined;
    if (srcdoc !== undefined && frameRunsScripts(element)) {
      if (depth >= MAX_NESTED_DOCUMENTS) return true;
      // A frame's document resolves against the base its document had when
      // the parser reached the frame in Chromium, but in WebKit against the
      // one it has once the frame's scripts load, which later markup may set.
      const frameBases = new Set([baseFor(element), baseFor(undefined)]);
      for (const frameBase of frameBases) {
        if (
          htmlPreviewHasScripts(srcdoc, depth + 1, frameBase, policies, budget)
        ) {
          return true;
        }
      }
    }
  }
  return false;
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
const SCRIPT_CDNS = `${PREVIEW_CDNS} https://cdn.tailwindcss.com https://code.jquery.com`;

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
 * policy. It still runs its scripts against its own DOM -- and those scripts
 * can still reach any host through WebRTC, a peer connection's STUN and TURN
 * servers: neither Chromium nor WebKit enforces the policy's `webrtc`
 * directive, `frame-src` does not stop an inline frame the page makes, and
 * that frame gets the API back if ours is removed (all measured). Only
 * holding a page's scripts, as the preview does until the reader asks,
 * keeps it offline.
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
  `script-src 'unsafe-inline' 'unsafe-eval' data: blob: ${SCRIPT_CDNS}`,
  ...PREVIEW_LOADS,
  'worker-src blob:',
  ...PREVIEW_LIMITS,
].join('; ');

// The hosts HTML_PREVIEW_POLICY lets a script load from, over https.
const SCRIPT_HOSTS = new Set(
  SCRIPT_CDNS.split(' ').map((source) => new URL(source).hostname)
);

/**
 * A `data:` URL as fetch reads it: its media type, what comes before the
 * first comma, less a `;base64` ending that marks a base64 body; and its
 * body, the rest up to any fragment, percent-decoded. Undefined with no
 * comma before the fragment, where it fails to load.
 */
function dataUrlParts(
  href: string
): { type: string; base64: boolean; body: string } | undefined {
  const input = href.split('#')[0];
  const comma = input.indexOf(',');
  if (comma < 0) return undefined;
  const type = input
    .slice('data:'.length, comma)
    .replace(/^[\t\n\f\r ]+|[\t\n\f\r ]+$/g, '');
  const base64 = /; *base64$/i.test(type);
  return {
    type: base64 ? type.replace(/; *base64$/i, '') : type,
    base64,
    body: percentDecoded(input.slice(comma + 1)),
  };
}

/** The essence of a `data:` URL's media type (dataUrlParts), `text/plain` when it names none. */
function dataUrlEssence(type: string): string {
  if (type === '' || type.startsWith(';')) type = `text/plain${type}`;
  return asciiLowercase(type.split(';')[0].replace(/[\t\n\f\r ]+$/, ''));
}

/**
 * Where a script element loads `src` from, when HTML_PREVIEW_POLICY lets it
 * and it can load (undefined when not), resolved against the document's web
 * base (webBase) when it has one: a `data:` URL, or https from one of the
 * script CDNs on its default port, as Chromium and WebKit measured -- not a
 * `blob:` one, which markup cannot name. A relative address with no web base
 * resolves against the app's own, which the policy refuses, and an empty one
 * loads nothing; either way the element's own text never runs. A
 * scheme-relative one takes https, as on the app's own page. A module runs
 * from `data:` only as JavaScript, by its media type; a classic script runs
 * as whatever it is. A `data:` URL with no body (dataUrlParts), or one of
 * nothing but whitespace, runs nothing, like an empty script element; a
 * base64 body counts as one only when empty.
 */
function scriptSource(
  src: string,
  base: string | undefined,
  module: boolean
): URL | undefined {
  const value = urlText(src);
  if (value === '') return undefined;
  let url: URL;
  try {
    url = new URL(
      base === undefined && value.startsWith('//') ? `https:${value}` : value,
      base
    );
  } catch {
    return undefined;
  }
  if (url.protocol === 'data:') {
    const data = dataUrlParts(url.href);
    if (data === undefined) return undefined;
    const code = data.base64
      ? data.body.replace(/[\t\n\f\r ]+/g, '')
      : data.body.trim();
    return code !== '' &&
      (!module || JAVASCRIPT_MIME_TYPES.has(dataUrlEssence(data.type)))
      ? url
      : undefined;
  }
  // A blob: URL loads only while a script that made it keeps it registered,
  // under a name no markup can know beforehand.
  return url.protocol === 'https:' &&
    url.port === '' &&
    SCRIPT_HOSTS.has(url.hostname)
    ? url
    : undefined;
}

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
 * Where the file's doctype ends, as the parser reads it: past a byte order
 * mark, whitespace and comment tokens ahead of it (comments, processing
 * instructions and bogus comments such as `<!foo>`), the index just past it;
 * -1 when anything else comes first, which leaves the document without one.
 * What we place here must come before anything of the file's that could run.
 * Read by parse5's tokenizer, which stops at the first other token.
 */
function doctypeEnd(html: string): number {
  const offset = html.charCodeAt(0) === 0xfeff ? 1 : 0;
  const stop = new Error('read past the doctype');
  let end = -1;
  const handler: TokenHandler = {
    onComment() {},
    onWhitespaceCharacter() {},
    onDoctype(token) {
      end = token.location ? token.location.endOffset + offset : -1;
      throw stop;
    },
    onStartTag() {
      throw stop;
    },
    onEndTag() {
      throw stop;
    },
    onCharacter() {
      throw stop;
    },
    onNullCharacter() {
      throw stop;
    },
    onEof() {
      throw stop;
    },
  };
  try {
    new Tokenizer({ sourceCodeLocationInfo: true }, handler).write(
      offset ? html.slice(1) : html,
      true
    );
  } catch (error) {
    if (error !== stop) throw error;
  }
  return end;
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
 * has to be harmless: a link aimed anywhere but `_blank` -- by its own target,
 * or the first `<base>` one; an SVG link ignores the `<base>`, and the
 * standard reads an empty target as the frame itself -- is pointed at
 * `_blank` for this click, so the default is a popup the sandbox refuses,
 * not a navigation of the frame, which the shell's `frame-src` would refuse,
 * leaving Chromium's blocked-page notice behind. It stays so while the
 * page's own handlers run: one that aims the link elsewhere, or changes the
 * `<base>`, is undone at the microtask checkpoint after it, before the
 * browser acts on the click, and what it set is put back afterwards.
 *
 * Then, if the page did not cancel it: a link that leaves the file goes to
 * the shell to be opened (htmlPreviewShell); one to a place in the file
 * scrolls there, since in a srcdoc document `#section` resolves against the
 * parent's address (unless the file sets a `<base href>` of its own, when the
 * fragment names that address and leaves the file like any other link); and
 * a `javascript:` link runs its code in the frame as a browser runs one --
 * a classic script in the global scope, a string it completes with replacing
 * the document -- which Chromium will not do in a document with an opaque
 * origin, unless the file's scripts are held, when it is the file's code and
 * does nothing. An SVG link is followed like an HTML one, and so is a MathML
 * element with an `href`, which WebKit follows and Chromium does not (its
 * `javascript:` href WebKit runs itself).
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
  var Observer = window.MutationObserver;
  var resolveURL = window.URL;
  // Called by another name, eval runs code as a classic script does: in the
  // global scope, giving back the value it completes with.
  var evaluate = window.eval;
  var XLINK = 'http://www.w3.org/1999/xlink';
  var SVG = 'http://www.w3.org/2000/svg';
  var MATHML = 'http://www.w3.org/1998/Math/MathML';
  var XHTML = 'http://www.w3.org/1999/xhtml';
  function hrefOf(node) {
    var raw = node.getAttribute('href');
    return raw !== null ? raw : node.getAttributeNS(XLINK, 'href');
  }
  // Where a click on the link is aimed: its own target, or for an HTML link
  // without one the first HTML <base> target; an SVG link ignores the <base>.
  // None is the frame itself, and so is an empty one as the standard reads
  // it, though Chromium and WebKit take the <base> target for it.
  function aimedAt(link) {
    var target = link.getAttribute('target');
    if (target === null && link.namespaceURI !== SVG) {
      var bases = document.getElementsByTagName('base');
      for (var i = 0; i < bases.length; i++) {
        if (bases[i].namespaceURI === XHTML && bases[i].hasAttribute('target')) {
          target = bases[i].getAttribute('target');
          break;
        }
      }
    }
    return target === null || target === '' ? '_self' : target.toLowerCase();
  }
  // Whether a browser follows this element as a link: an HTML or SVG <a> or
  // an HTML <area> with an address (an <area> in an svg is an unknown
  // element), or a MathML element with an href, which WebKit follows
  // (Chromium does not).
  function isLink(node) {
    if (node.namespaceURI === MATHML) return node.hasAttribute('href');
    var element = node.localName === 'a' ? node.namespaceURI === XHTML || node.namespaceURI === SVG : node.localName === 'area' && node.namespaceURI === XHTML;
    return element && hrefOf(node) !== null;
  }
  // The link a click is on.
  function linkIn(event) {
    var nodes = composedPath.call(event);
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (node && node.nodeType === 1 && isLink(node)) return node;
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
  // a link does, and the browser took it -- the file's own base-uri may
  // refuse it. With any other the browser would resolve a relative link
  // against the app's address.
  function webBase() {
    var elements = document.querySelectorAll('base[href]');
    for (var i = 0; i < elements.length; i++) {
      if (elements[i].namespaceURI !== XHTML) continue;
      var href = urlText(elements[i].getAttribute('href'));
      var taken = parse(href, document.baseURI);
      if (!taken || taken.href !== document.baseURI) return null;
      var url = parse(href.slice(0, 2) === '//' ? 'https:' + href : href);
      return url && /^https?:$/.test(url.protocol) ? url.href : null;
    }
    return null;
  }
  // The element a fragment names: the one with that id, or else the first
  // <a> with that name.
  function indicated(fragment) {
    var element = document.getElementById(fragment);
    if (element) return element;
    var anchors = document.getElementsByTagName('a');
    for (var i = 0; i < anchors.length; i++) {
      if (anchors[i].getAttribute('name') === fragment) return anchors[i];
    }
    return null;
  }
  // As the browser scrolls to a fragment: the fragment as the URL parser
  // writes it first, then percent-decoded, and the top of the document for an
  // empty one or one that decodes to "top".
  // A javascript: URL's code, percent-decoded as a browser decodes it: an
  // escape that is not two hex digits stays as written, and the escaped
  // bytes decode as UTF-8, a malformed sequence as U+FFFD.
  function percentDecoded(text) {
    return text.replace(/(?:%[0-9A-Fa-f]{2})+/g, function (run) {
      var bytes = new Uint8Array(run.length / 3);
      for (var i = 0; i < bytes.length; i++) bytes[i] = parseInt(run.substr(i * 3 + 1, 2), 16);
      return new TextDecoder().decode(bytes);
    });
  }
  function scrollToFragment(raw) {
    var url = parse(raw, 'about:srcdoc');
    var fragment = url ? url.hash.slice(1) : raw.slice(1);
    if (fragment === '') { window.scrollTo(0, 0); return; }
    var element = indicated(fragment);
    var decoded = fragment;
    if (!element) {
      try { decoded = decodeURIComponent(fragment); } catch (error) {}
      element = indicated(decoded);
    }
    if (element) element.scrollIntoView();
    else if (decoded.toLowerCase() === 'top') window.scrollTo(0, 0);
  }
  function follow(event) {
    if (event.type === 'auxclick' && event.button !== 1) return;
    var link = linkIn(event);
    if (!link) return;
    var target = link.getAttribute('target');
    var forced = false;
    function aim() {
      if (aimedAt(link) === '_blank') return;
      target = link.getAttribute('target');
      link.setAttribute('target', '_blank');
      forced = true;
    }
    aim();
    var watch = new Observer(aim);
    watch.observe(document, { attributes: true, attributeFilter: ['target'], childList: true, subtree: true });
    var trusted = event.isTrusted;
    later(function () {
      watch.disconnect();
      if (forced) {
        if (target === null) link.removeAttribute('target');
        else link.setAttribute('target', target);
      }
      if (event.defaultPrevented) return;
      var raw = urlText(hrefOf(link));
      if (/^javascript:/i.test(raw)) {
        // WebKit runs a MathML element's javascript: href itself.
        if (!runsJavascriptLinks || link.namespaceURI === MATHML) return;
        var code = percentDecoded(raw.replace(/^javascript:/i, ''));
        // As a browser runs such a link: a string it completes with is the
        // markup of the document that replaces this one, which our listeners
        // then watch as they did this.
        var result = evaluate(code);
        if (typeof result === 'string') {
          document.open();
          document.write(result);
          document.close();
          listen();
        }
        return;
      }
      // A relative link resolves only against a web base the file sets
      // itself: a Bucket file has no address of its own its neighbours could
      // be reached from. Without one a fragment, or an empty href, stays in
      // the file, and a scheme-relative link takes https. Each address is
      // computed here, never left to resolve against the app's.
      var scheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw);
      var base = webBase();
      if (!scheme && !base && (raw === '' || raw.charAt(0) === '#')) { scrollToFragment(raw); return; }
      if (!trusted) return;
      // Against the file's base whenever it has one: \`https:help\` is relative
      // to an https base, as the URL parser reads it.
      var url = base ? parse(raw, base) : scheme ? parse(raw) : raw.slice(0, 2) === '//' ? parse('https:' + raw) : null;
      if (url) shell.postMessage({ type: '${HTML_PREVIEW_LINK_MESSAGE}', key: key, href: url.href }, '*');
    }, 0);
  }
  function listen() {
    window.addEventListener('click', follow, true);
    window.addEventListener('auxclick', follow, true);
  }
  listen();
  var self = document.currentScript;
  if (self) self.remove();
})('${key}', ${nonce === undefined});
</script>`;
}

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
 * A document's `<base href>` elements, in tree order: the HTML ones the
 * parser makes the document's -- not one in a template, an svg or math, nor,
 * as Electron's parser drops it, one in a select. The first sets the
 * document's base.
 */
function baseElements(document: ParsedDocument): ParsedElement[] {
  const bases: ParsedElement[] = [];
  for (const element of elementsOf(document, () => false)) {
    if (
      element.nodeName === 'base' &&
      element.namespaceURI === NS.HTML &&
      attributeOf(element, 'href') !== undefined
    ) {
      bases.push(element);
    }
  }
  return bases;
}

/**
 * For an element, the base in force when the parser made it: the first of
 * `bases` (in tree order) made before it. The earliest any of the first
 * bases was made only falls along the list, so a binary search finds it --
 * a file can hold tens of thousands of each.
 */
function baseReached(
  bases: ParsedElement[]
): (element: ParsedElement) => ParsedElement | undefined {
  const earliest: number[] = [];
  for (const base of bases) {
    earliest.push(Math.min(earliest.at(-1) ?? Infinity, createdAt(base)));
  }
  return (element) => {
    const at = createdAt(element);
    let low = 0;
    let high = bases.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (earliest[middle] < at) high = middle;
      else low = middle + 1;
    }
    return bases[low];
  };
}

/**
 * Where relative links under `base` resolve, when they may: its address
 * resolved against the base its document inherits, when that is a web
 * address. A Bucket file inherits none it may use -- it has no address of its
 * own its neighbours could be reached from -- so there only an absolute web
 * base counts, or a scheme-relative one, which takes https as a link does;
 * without one, links go nowhere. A `srcdoc` document inherits the base around
 * it. A base that does not parse is passed over for the inherited one, and,
 * as in Chromium, so is one naming a `data:` or `javascript:` URL.
 */
function webBase(
  base: ParsedElement | undefined,
  inherited: string | undefined
): string | undefined {
  if (base === undefined) return inherited;
  const value = urlText(attributeOf(base, 'href') ?? '');
  let url: URL;
  try {
    url = new URL(
      inherited === undefined && value.startsWith('//')
        ? `https:${value}`
        : value,
      inherited
    );
  } catch {
    return inherited;
  }
  if (url.protocol === 'data:' || url.protocol === 'javascript:') {
    return inherited;
  }
  return url.protocol === 'http:' || url.protocol === 'https:'
    ? url.href
    : undefined;
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
  // Against the file's base whenever it has one: `https:help` is relative to
  // an https base, as the URL parser reads it.
  if (base !== undefined) {
    return { address: linkAddress(value, base), aimed: '_blank' };
  }
  if (URL_SCHEME.test(value)) {
    return { address: linkAddress(value), aimed: '_blank' };
  }
  if (value === '' || value[0] === '#') {
    return { address: `about:srcdoc#${value.slice(1)}`, aimed: '_self' };
  }
  if (value.startsWith('//')) {
    return { address: linkAddress(`https:${value}`), aimed: '_blank' };
  }
  return { aimed: '_blank' };
}

// A link's address, its target, and `download`: the frame cannot download,
// so a link that asked to would be left doing nothing.
const LINK_ATTRIBUTES = new Set(['download', 'href', 'target', 'xlink:href']);
const SRCDOC_ATTRIBUTE = new Set(['srcdoc']);

/**
 * The file's markup with every link -- an HTML or SVG `<a>`, an HTML
 * `<area>`, and any MathML element with an `href`, which WebKit follows --
 * made safe to follow with no script running, as under Electron. A link
 * Electron's parser reads otherwise than parse5 still opens only through the
 * desktop shell's window-open handler, which hands the system browser web,
 * mail and phone addresses alone, and there a relative address resolves
 * against the app's `file:` one.
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
 * - A relative link resolves against the file's own base (webBase), and
 *   without one goes nowhere, except that a fragment stays in the file: it
 *   points at `about:srcdoc#section`, aimed at the frame itself, which
 *   scrolls there without reloading. A scheme-relative one takes https.
 * - A document in an `<iframe srcdoc>` inherits the frame's popups, so its
 *   links are settled too, MAX_NESTED_DOCUMENTS deep; a `srcdoc` deeper than
 *   that is dropped. It inherits the base the document around it had when
 *   the parser reached the frame, as Chromium takes it, and the policies in
 *   force then, whose `base-uri` can refuse a `<base>` of its own.
 *
 * With no script to change it, the markup is the document, so rewriting it
 * covers every link. An ordinary template's content never renders without a
 * script, so its links and frames are left as they are (a declarative shadow
 * root's are rewritten). Each document is parsed as a frame without scripts
 * parses it, and each link's start tag rewritten where it stands in the
 * source, so text that only looks like a link is left as it is, and so is a
 * link the parser drops (inside a select). Null when the file cannot be read
 * (htmlPreviewReadable); a nested document that cannot be is dropped.
 */
function withLinksAimedAtBlank(
  html: string,
  depth = 0,
  inherited?: string,
  inheritedPolicies: AuthoredPolicy[] = []
): string | null {
  const parsed = depth === 0 ? parsedHtml(html, false) : parseHtml(html, false);
  if (!parsed) return null;
  const baseFor = baseResolver(parsed.document, inherited, inheritedPolicies);
  const base = baseFor(undefined);
  const policies = [...inheritedPolicies];
  const edits: { start: number; end: number; text: string }[] = [];
  const rewritten = new Set<number>();
  for (const element of elementsOf(parsed.document, shadowRootsAttached())) {
    const policy = authoredPolicy(element);
    if (policy) policies.push(policy);
    const tag = element.sourceCodeLocation?.startTag;
    const link =
      element.namespaceURI === NS.MATHML
        ? attributeOf(element, 'href') !== undefined
        : element.nodeName === 'a' ||
          (element.nodeName === 'area' && element.namespaceURI === NS.HTML);
    const srcdoc =
      element.nodeName === 'iframe' && element.namespaceURI === NS.HTML
        ? attributeOf(element, 'srcdoc')
        : undefined;
    // An element the parser rebuilt (a link reopened past a misnested end
    // tag) shares its start tag with the first.
    if (
      !tag ||
      (!link && srcdoc === undefined) ||
      rewritten.has(tag.startOffset)
    ) {
      continue;
    }
    rewritten.add(tag.startOffset);
    const start = tag.startOffset + parsed.offset;
    const end = tag.endOffset + parsed.offset;
    let nameEnd = start + 1;
    while (nameEnd < end) {
      const code = html.charCodeAt(nameEnd);
      if (isHtmlSpace(code) || code === 47 || code === 62) break;
      nameEnd += 1;
    }
    const attributes = html.slice(nameEnd, end - 1);
    let text: string;
    if (link) {
      // xlink:href is an address only on a foreign (SVG) link, where the
      // parser gives it XLink's namespace; on an HTML one it is a name.
      const { address, aimed } = settledLink(
        attributeOf(element, 'href') ??
          (element.namespaceURI === NS.SVG
            ? attributeOf(element, 'href', NS.XLINK)
            : undefined),
        base
      );
      text =
        ` target="${aimed}"` +
        (address === undefined ? '' : ` href="${escapeAttribute(address)}"`) +
        withoutAttributes(attributes, LINK_ATTRIBUTES);
    } else {
      // The frame's document inherits the base set by the time the parser
      // reached the frame, and the policies in force then.
      const nested =
        depth < MAX_NESTED_DOCUMENTS && srcdoc !== undefined
          ? withLinksAimedAtBlank(srcdoc, depth + 1, baseFor(element), policies)
          : null;
      text =
        (nested === null ? '' : ` srcdoc="${escapeAttribute(nested)}"`) +
        withoutAttributes(attributes, SRCDOC_ATTRIBUTE);
    }
    edits.push({ start: nameEnd, end, text: text + '>' });
  }
  // The tree's order is not always the source's: a table's misplaced content
  // is moved ahead of it.
  edits.sort((first, second) => first.start - second.start);
  let out = '';
  let copied = 0;
  for (const edit of edits) {
    out += html.slice(copied, edit.start) + edit.text;
    copied = edit.end;
  }
  return out + html.slice(copied);
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
    // A file the preview cannot read is not previewed (htmlPreviewReadable);
    // rendered anyway, it would render empty rather than unsettled.
    return withDocumentHead(
      withLinksAimedAtBlank(html) ?? '',
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
 * the shell and the frame inside it alike. The inline documents load, and so
 * does anything else at an `about:` address: the shell itself loads at
 * `about:blank`, so a file can blank its own frame (a meta refresh there), as
 * it can on web. Everything else -- a link, a meta refresh, a form, a
 * redirect, any other scheme -- is refused, so a document cannot bounce the
 * reader into another app or show them a page that is not the file. A link
 * the reader taps does not come this way: our script keeps the frame from
 * following it and the shell asks the app to open it (htmlPreviewShell), so
 * nothing here has to judge whether a navigation the WebView reports came
 * from a tap.
 */
export function htmlPreviewNavigation({
  url,
}: {
  url: string;
}): HtmlPreviewNavigation {
  return url.startsWith('about:') ? 'load' : 'block';
}
