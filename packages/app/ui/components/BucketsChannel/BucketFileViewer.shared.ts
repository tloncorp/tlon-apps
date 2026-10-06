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

/**
 * The charset an HTML file declares in its first bytes, found as a browser's
 * encoding prescan finds it: comments are skipped, and only a `<meta>` with a
 * `charset` attribute, or one with `http-equiv="content-type"` whose
 * `content` names a charset, declares one. `charset=` anywhere else -- in a
 * comment, in a description -- does not, and a declaration whose label names
 * no encoding (encodingOf) is read past. The result is encodingOf's name.
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
    const charset = attributes.get('charset');
    if (charset !== undefined && charset.trim() !== '') {
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

// Elements whose content the parser reads as text, not markup: the raw-text
// and escapable raw-text elements, and plaintext. With scripting on a
// noscript's content is text too; in a frame without scripts it is markup.
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
const SCRIPTED_TEXT_ELEMENTS = new Set([...TEXT_CONTENT_ELEMENTS, 'noscript']);

// Where foreign content is HTML again: an svg's foreignObject, desc and
// title, and MathML's text elements (and an annotation-xml that says it
// holds HTML).
const SVG_HTML_ELEMENTS = new Set(['desc', 'foreignobject', 'title']);
const MATHML_TEXT_ELEMENTS = new Set(['mi', 'mn', 'mo', 'ms', 'mtext']);

// The start tags that end foreign content: the parser closes the open svg or
// math and reads the tag as HTML (`font` only with color, face or size).
const FOREIGN_BREAKOUTS = new Set([
  'b',
  'big',
  'blockquote',
  'body',
  'br',
  'center',
  'code',
  'dd',
  'div',
  'dl',
  'dt',
  'em',
  'embed',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'head',
  'hr',
  'i',
  'img',
  'li',
  'listing',
  'menu',
  'meta',
  'nobr',
  'ol',
  'p',
  'pre',
  'ruby',
  's',
  'small',
  'span',
  'strong',
  'strike',
  'sub',
  'sup',
  'table',
  'tt',
  'u',
  'ul',
  'var',
]);

// HTML's ASCII whitespace: tab, line feed, form feed, carriage return, space.
function isHtmlSpace(code: number): boolean {
  return code === 9 || code === 10 || code === 12 || code === 13 || code === 32;
}

function isAsciiLetter(code: number): boolean {
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

/**
 * Where a tag whose name ends at `from` ends -- the index just past its `>`,
 * or -1 when it never ends -- and whether it closes itself (`<svg/>`). It
 * reads the attributes in the tokenizer's states: a quote opens a quoted
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

// Whether the character after an end tag's name ends the name.
function endsTagName(code: number): boolean {
  return isHtmlSpace(code) || code === 47 || code === 62;
}

/**
 * Where the end tag of a script whose content starts at `from` starts in
 * `lower`; -1 when it never ends. Through the tokenizer's script-data states:
 * after `<!--` the content is escaped, where `<script` opens a double-escaped
 * stretch whose `</script>` only closes that stretch, and `-->` ends either.
 * One pass: the next `-->` is searched for only once the scan is past the
 * last one found.
 */
function scriptEndStart(lower: string, from: number): number {
  // 0: script data; 1: escaped; 2: double escaped.
  let state = 0;
  // Where the next `-->` is, from where it was last searched for; -1 when
  // there is none left.
  let dashes = -2;
  let i = from;
  for (;;) {
    const lt = lower.indexOf('<', i);
    if (state !== 0) {
      if (dashes !== -1 && dashes < i) dashes = lower.indexOf('-->', i);
      if (dashes >= 0 && (lt < 0 || dashes < lt)) {
        state = 0;
        i = dashes + 3;
        continue;
      }
    }
    if (lt < 0) return -1;
    if (state === 0 && lower.startsWith('<!--', lt)) {
      // The opener's dashes count toward `-->`: `<!-->` ends at once.
      state = 1;
      i = lt + 2;
      continue;
    }
    if (
      lower.startsWith('</script', lt) &&
      endsTagName(lower.charCodeAt(lt + 8))
    ) {
      if (state !== 2) return lt;
      state = 1;
      i = lt + 8;
      continue;
    }
    if (
      state === 1 &&
      lower.startsWith('<script', lt) &&
      endsTagName(lower.charCodeAt(lt + 7))
    ) {
      state = 2;
      i = lt + 7;
      continue;
    }
    i = lt + 1;
  }
}

/** A start tag, as markupTags reads it. */
interface MarkupTag {
  /** Its name, ASCII-lowercased. */
  name: string;
  /** Where its name ends, and just past its `>`. */
  nameEnd: number;
  end: number;
  /**
   * For an element whose content the parser reads as text here: where that
   * text ends, at its end tag, or -1 when it runs to the end of the file.
   */
  textEnd?: number;
  /**
   * The namespace of the element it makes: `svg` or `math` in foreign
   * content -- inside an svg or math, and not at an integration point in one
   * -- and `html` anywhere else.
   */
  namespace: 'html' | 'svg' | 'math';
  /** Whether a template is open around it. */
  withinTemplate: boolean;
  /**
   * Whether an ordinary template is open around it, whose content is inert:
   * nothing in it runs unless a script copies it out. A declarative shadow
   * root's template (`shadowrootmode` open or closed) holds live content,
   * so on its own it does not make what it holds inert -- even on a host
   * that cannot take one, where the browser keeps it as an ordinary template.
   */
  inert: boolean;
}

/**
 * The start tags of a document, in order, read as the tokenizer reads them
 * and as far as the tree builder decides how it reads them: past comments,
 * doctypes and the like (pastNonTag), and past the content of the elements
 * whose content is text there (`textElements`, which depend on whether the
 * frame runs scripts; a script's ends through its escape states). Inside an
 * svg or math no element's content is text, and CDATA sections exist. At an
 * integration point in one -- an SVG foreignObject, desc or title, a MathML
 * text element, an annotation-xml holding HTML -- the content is HTML again.
 * An HTML-only tag such as `<p>` or `<div>` closes the svg or math, and an end
 * tag in foreign content closes the nearest open element of its name with
 * whatever it holds. Of the tree, the foreign elements and templates are
 * tracked, not the HTML ones: an end tag is read as if none were open inside
 * an integration point.
 *
 * Inside a `<select>`, WebKit's parser ignores the start tag of such an
 * element other than script and textarea, and reads what follows as markup;
 * Chromium's reads it as text. `markupInSelect` reads it as markup, for a
 * scan that must see whatever either could run.
 *
 * A scan rather than a regular expression, for the reason htmlPreviewTitle
 * gives: it reads each character a fixed number of times.
 */
function* markupTags(
  html: string,
  textElements: Set<string>,
  { markupInSelect = false }: { markupInSelect?: boolean } = {}
): Generator<MarkupTag> {
  const lower = asciiLowercase(html);
  // The open templates: how many foreign elements were open around each, and
  // whether its content is inert; and how many are. A template is an HTML
  // element, so an end tag inside it reaches nothing outside it, and its own
  // end tag closes whatever it holds.
  const templateDepths: number[] = [];
  const templatesInert: boolean[] = [];
  let inertTemplates = 0;
  // The open foreign elements: each with its namespace, and whether its
  // content is HTML (an integration point). The innermost decides how the
  // scan reads. `open` counts them by name within each template, so an end
  // tag finds whether one it can reach is open in constant time: a file of
  // open svgs and stray end tags stays linear.
  const scopes: {
    html: boolean;
    name: string;
    namespace: 'svg' | 'math';
    key: string;
  }[] = [];
  const open = new Map<string, number>();
  const reach = (name: string) => `${templateDepths.length} ${name}`;
  const push = (
    name: string,
    namespace: 'svg' | 'math',
    htmlInside: boolean
  ) => {
    const key = reach(name);
    scopes.push({ html: htmlInside, key, name, namespace });
    open.set(key, (open.get(key) ?? 0) + 1);
  };
  const pop = () => {
    const scope = scopes.pop();
    if (scope) open.set(scope.key, (open.get(scope.key) ?? 1) - 1);
  };
  let selects = 0;
  const foreign = () => scopes.length > 0 && !scopes[scopes.length - 1].html;
  let i = 0;
  for (;;) {
    const lt = html.indexOf('<', i);
    if (lt < 0) return;
    const past = pastNonTag(html, lt, foreign());
    if (past !== undefined) {
      if (past < 0) return;
      i = past;
      continue;
    }
    const closing = html.charCodeAt(lt + 1) === 47;
    const nameStart = lt + (closing ? 2 : 1);
    if (!isAsciiLetter(html.charCodeAt(nameStart))) {
      i = lt + 1;
      continue;
    }
    let nameEnd = nameStart;
    while (nameEnd < html.length) {
      const code = html.charCodeAt(nameEnd);
      if (isHtmlSpace(code) || code === 47 || code === 62) break;
      nameEnd += 1;
    }
    const name = lower.slice(nameStart, nameEnd);
    const { end, selfClosing } = startTag(html, nameEnd);
    if (end < 0) return;
    i = end;
    if (closing) {
      if (foreign() && (name === 'br' || name === 'p')) {
        while (foreign()) pop();
      } else if ((open.get(reach(name)) ?? 0) > 0) {
        while (scopes[scopes.length - 1].name !== name) pop();
        pop();
      } else if (name === 'template' && templateDepths.length > 0) {
        // No foreign template is open within reach, so it ends the innermost
        // HTML template, in HTML or in foreign content alike, and everything
        // opened inside it.
        const depth = templateDepths.pop()!;
        while (scopes.length > depth) pop();
        if (templatesInert.pop()) inertTemplates -= 1;
      } else if (name === 'select' && selects > 0 && !foreign()) {
        selects -= 1;
      }
      continue;
    }
    const attributes = tagAttributes(html.slice(nameEnd, end - 1));
    if (
      foreign() &&
      (FOREIGN_BREAKOUTS.has(name) ||
        (name === 'font' &&
          (attributes.has('color') ||
            attributes.has('face') ||
            attributes.has('size'))))
    ) {
      while (foreign()) pop();
    }
    // At a MathML text element, mglyph and malignmark are MathML still,
    // where any other start tag makes HTML.
    const innermost = scopes[scopes.length - 1];
    const inForeignContent =
      foreign() ||
      (innermost !== undefined &&
        innermost.namespace === 'math' &&
        MATHML_TEXT_ELEMENTS.has(innermost.name) &&
        (name === 'mglyph' || name === 'malignmark'));
    // A foreign element takes its parent's namespace -- except an svg
    // straight inside an annotation-xml, which the parser makes SVG.
    const namespace = !inForeignContent
      ? undefined
      : name === 'svg' &&
          innermost.namespace === 'math' &&
          innermost.name === 'annotation-xml'
        ? 'svg'
        : innermost.namespace;
    const tag: MarkupTag = {
      name,
      nameEnd,
      end,
      namespace: namespace ?? 'html',
      withinTemplate: templateDepths.length > 0,
      inert: inertTemplates > 0,
    };
    if (namespace !== undefined) {
      // Every foreign element is tracked, so that an end tag can close the
      // ones it holds, and a foreign element can close itself.
      const encoding = asciiLowercase(
        parseEntities(attributes.get('encoding') ?? '', { attribute: true })
      );
      const opensHtml =
        namespace === 'svg'
          ? SVG_HTML_ELEMENTS.has(name)
          : MATHML_TEXT_ELEMENTS.has(name) ||
            (name === 'annotation-xml' &&
              (encoding === 'text/html' ||
                encoding === 'application/xhtml+xml'));
      if (!selfClosing) push(name, namespace, opensHtml);
    } else if (name === 'svg' || name === 'math') {
      // An HTML element cannot close itself; a foreign one can.
      if (!selfClosing) push(name, name, false);
    } else if (name === 'template') {
      const mode = asciiLowercase(
        parseEntities(attributes.get('shadowrootmode') ?? '', {
          attribute: true,
        })
      );
      const inert = mode !== 'open' && mode !== 'closed';
      templateDepths.push(scopes.length);
      templatesInert.push(inert);
      if (inert) inertTemplates += 1;
    } else if (name === 'select') {
      selects += 1;
    }
    if (
      inForeignContent ||
      !textElements.has(name) ||
      (markupInSelect &&
        selects > 0 &&
        name !== 'script' &&
        name !== 'textarea')
    ) {
      yield tag;
      continue;
    }
    if (name === 'plaintext') {
      yield { ...tag, textEnd: -1 };
      return;
    }
    const close =
      name === 'script'
        ? scriptEndStart(lower, end)
        : endTagStart(lower, name, end);
    yield { ...tag, textEnd: close };
    if (close < 0) return;
    const closeEnd = startTagEnd(html, close + 2 + name.length);
    if (closeEnd < 0) return;
    i = closeEnd;
  }
}

/**
 * The title of an HTML file, as the page itself would show it: the first
 * `<title>` the parser would make the document's -- not one in a comment, an
 * attribute, a script or style, a template (nested ones included), or an
 * `<svg>`'s own, which is a tooltip (an HTML one in its foreignObject counts)
 * -- with character references decoded and
 * ASCII whitespace collapsed, the way `document.title` reads it. Undefined
 * when the file has none or it is blank. In a frame that runs no scripts (`scripting: false`, under Electron), a `<noscript>` holds
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
  for (const tag of markupTags(
    html,
    scripting ? SCRIPTED_TEXT_ELEMENTS : TEXT_CONTENT_ELEMENTS
  )) {
    if (
      tag.name !== 'title' ||
      tag.namespace !== 'html' ||
      tag.withinTemplate
    ) {
      continue;
    }
    if (tag.textEnd === undefined) return undefined;
    // Character references decoded as a browser decodes them in text: every
    // named reference, the legacy ones without a semicolon, and numeric
    // references with a browser's replacements. A title never closed runs to
    // the end of the file, as the parser reads it.
    const textEnd = tag.textEnd < 0 ? html.length : tag.textEnd;
    const title = parseEntities(html.slice(tag.end, textEnd))
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
 * What a browser prepares a script element with these attributes
 * (tagAttributes) as: a classic script, a module, or data it never runs.
 * Without a type its language names one (`text/` and the language), and with
 * neither it is JavaScript; an empty type is JavaScript; any other type,
 * trimmed, must be exactly a JavaScript MIME type (a `charset` parameter makes
 * it data) or `module`. JSON-LD, `text/plain`, a template, an import map or
 * speculation rules never run. Chromium also trims a vertical tab from the
 * type.
 */
function scriptKind(
  attributes: Map<string, string>
): 'classic' | 'module' | undefined {
  const type = attributes.get('type');
  if (type === undefined) {
    const language = attributes.get('language');
    if (language === undefined) return 'classic';
    const name = parseEntities(language, { attribute: true });
    return name === '' ||
      JAVASCRIPT_MIME_TYPES.has(`text/${asciiLowercase(name)}`)
      ? 'classic'
      : undefined;
  }
  const value = parseEntities(type, { attribute: true });
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

// The events an `on<event>` content attribute handles on some element in
// Chromium or WebKit: every event handler property of an HTML, SVG or MathML
// element interface, the window's that <body> forwards, and iOS's gesture
// events. Any other attribute starting with `on` (`only`, `onward`) is data.
const HANDLED_EVENTS = new Set(
  `
  abort afterprint animationcancel animationend animationiteration
  animationstart auxclick beforecopy beforecut beforeinput beforeload
  beforematch beforepaste beforeprint beforetoggle beforeunload
  beforexrselect begin blur cancel canplay canplaythrough change click close
  command contentvisibilityautostatechange contextlost contextmenu
  contextrestored copy cuechange cut dblclick drag dragend dragenter
  dragleave dragover dragstart drop durationchange emptied encrypted end
  ended enterpictureinpicture error focus focusin focusout formdata
  fullscreenchange fullscreenerror gamepadconnected gamepaddisconnected
  gesturechange gestureend gesturestart gotpointercapture hashchange input
  invalid keydown keypress keyup languagechange leavepictureinpicture load
  loadeddata loadedmetadata loadstart lostpointercapture message
  messageerror mousedown mouseenter mouseleave mousemove mouseout mouseover
  mouseup mousewheel offline online orientationchange pagehide pagereveal
  pageshow pageswap paste pause play playing pointercancel pointerdown
  pointerenter pointerleave pointermove pointerout pointerover
  pointerrawupdate pointerup popstate progress ratechange rejectionhandled
  repeat reset resize scroll scrollend scrollsnapchange scrollsnapchanging
  search securitypolicyviolation seeked seeking select selectionchange
  selectstart slotchange stalled storage submit suspend timeupdate toggle
  touchcancel touchend touchforcechange touchmove touchstart
  transitioncancel transitionend transitionrun transitionstart
  unhandledrejection unload volumechange waiting waitingforkey
  webkitanimationend webkitanimationiteration webkitanimationstart
  webkitcurrentplaybacktargetiswirelesschanged webkitfullscreenchange
  webkitfullscreenerror webkitmouseforcechanged webkitmouseforcedown
  webkitmouseforceup webkitmouseforcewillbegin webkitneedkey
  webkitplaybacktargetavailabilitychanged webkitpresentationmodechanged
  webkittransitionend wheel
`
    .trim()
    .split(/\s+/)
);

/**
 * Whether a browser would run a `javascript:` URL in this attribute of this
 * element, as measured in a preview running the page's scripts: a link the
 * reader follows -- an HTML link's href, an SVG link's href or xlink:href, a
 * MathML element's href (WebKit) -- or an inline frame's src (Chromium). A
 * form cannot submit and an object or embed cannot load in a preview, and
 * any other URL is fetched, never run.
 */
function runsJavascriptUrl(tag: MarkupTag, attribute: string): boolean {
  switch (tag.namespace) {
    case 'math':
      return attribute === 'href';
    case 'svg':
      return (
        tag.name === 'a' && (attribute === 'href' || attribute === 'xlink:href')
      );
    case 'html':
      return attribute === 'href'
        ? tag.name === 'a' || tag.name === 'area'
        : attribute === 'src' &&
            (tag.name === 'iframe' || tag.name === 'frame');
  }
}

/**
 * Whether an HTML file has anything a script would run from: an HTML or SVG
 * script element that runs code (scriptKind; a classic HTML one marked
 * `nomodule` is skipped by every browser that runs modules, and a MathML one
 * is never run), an event handler attribute (HANDLED_EVENTS), a
 * `javascript:` URL where a browser runs one (runsJavascriptUrl) -- read as
 * the browser reads it, so `java&#x73;cript:` counts -- or any of these in an
 * HTML iframe's `srcdoc`, outside an inert template. A page without any
 * renders the same with scripts off, so there is nothing to run. A `srcdoc`
 * nested deeper than MAX_NESTED_DOCUMENTS is taken to have some.
 *
 * Each document is read by markupTags as a frame that runs scripts reads it,
 * and inside a `<select>` as WebKit reads it: a script that only Safari would
 * run still counts.
 */
export function htmlPreviewHasScripts(html: string, depth = 0): boolean {
  for (const tag of markupTags(html, SCRIPTED_TEXT_ELEMENTS, {
    markupInSelect: true,
  })) {
    if (tag.inert) continue;
    const attributes = tagAttributes(html.slice(tag.nameEnd, tag.end - 1));
    if (tag.name === 'script' && tag.namespace !== 'math') {
      const kind = scriptKind(attributes);
      if (
        kind === 'module' ||
        (kind === 'classic' &&
          (tag.namespace === 'svg' || !attributes.has('nomodule')))
      ) {
        return true;
      }
    }
    for (const [attribute, value] of attributes) {
      if (
        attribute.startsWith('on') &&
        HANDLED_EVENTS.has(attribute.slice(2))
      ) {
        return true;
      }
      if (
        runsJavascriptUrl(tag, attribute) &&
        urlScheme(value) === 'javascript'
      ) {
        return true;
      }
      if (
        attribute === 'srcdoc' &&
        tag.namespace === 'html' &&
        tag.name === 'iframe' &&
        (depth >= MAX_NESTED_DOCUMENTS ||
          htmlPreviewHasScripts(
            parseEntities(value, { attribute: true }),
            depth + 1
          ))
      ) {
        return true;
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
 * Where the file's doctype ends: after any byte order mark, whitespace and
 * comment tokens ahead of it (comments, processing instructions and bogus
 * comments such as `<!foo>`), the index just past its `>`; -1 when the file
 * has none. Comments end where the tokenizer ends them
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
    // Comment tokens of every kind: `<!--`, a processing instruction, and a
    // bogus comment (`<!foo>`, `</ x>`), but not the doctype itself.
    const comment =
      html.startsWith('<!--', i) ||
      html.startsWith('<?', i) ||
      (html.startsWith('<!', i) &&
        asciiLowercase(html.slice(i, i + 9)) !== '<!doctype') ||
      (html.startsWith('</', i) && !isAsciiLetter(html.charCodeAt(i + 2)));
    if (!comment) break;
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
  var Observer = window.MutationObserver;
  var resolveURL = window.URL;
  var run = Function;
  var XLINK = 'http://www.w3.org/1999/xlink';
  var SVG = 'http://www.w3.org/2000/svg';
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
      var base = webBase();
      if (!scheme && !base && (raw === '' || raw.charAt(0) === '#')) { scrollToFragment(raw); return; }
      if (!trusted) return;
      // Against the file's base whenever it has one: \`https:help\` is relative
      // to an https base, as the URL parser reads it.
      var url = base ? parse(raw, base) : scheme ? parse(raw) : raw.slice(0, 2) === '//' ? parse('https:' + raw) : null;
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
 * The `href` of the first `<base href>` that sets the document's base, read
 * by markupTags as a frame without scripts reads the file: not inside a
 * template, nor in an svg's or math's own content, where a base sets nothing.
 * Undefined when the file has none.
 */
function authoredBaseHref(html: string): string | undefined {
  for (const tag of markupTags(html, TEXT_CONTENT_ELEMENTS)) {
    if (tag.name !== 'base' || tag.namespace !== 'html' || tag.withinTemplate) {
      continue;
    }
    const href = tagAttributes(html.slice(tag.nameEnd, tag.end - 1)).get(
      'href'
    );
    if (href !== undefined) return href;
  }
  return undefined;
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
 * covers every link. Each document is read by markupTags as a frame without
 * scripts reads it, so text that only looks like a link is left as it is.
 */
function withLinksAimedAtBlank(html: string, depth = 0): string {
  const base = fileWebBase(html);
  let rewritten = '';
  let copied = 0;
  for (const { name, namespace, nameEnd, end } of markupTags(
    html,
    TEXT_CONTENT_ELEMENTS
  )) {
    if (name === 'a' || name === 'area') {
      const attributes = html.slice(nameEnd, end - 1);
      const values = tagAttributes(attributes);
      // xlink:href is an address only where the parser gives it XLink's
      // namespace, on a foreign (SVG) link; on an HTML one it is a name.
      const { address, aimed } = settledLink(
        values.get('href') ??
          (namespace !== 'html' ? values.get('xlink:href') : undefined),
        base
      );
      rewritten +=
        html.slice(copied, nameEnd) +
        ` target="${aimed}"` +
        (address === undefined ? '' : ` href="${escapeAttribute(address)}"`) +
        withoutAttributes(attributes, LINK_ATTRIBUTES) +
        '>';
      copied = end;
    } else if (name === 'iframe') {
      const attributes = html.slice(nameEnd, end - 1);
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
        copied = end;
      }
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
