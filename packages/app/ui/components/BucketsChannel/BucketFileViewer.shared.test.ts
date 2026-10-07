import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  HTML_PREVIEW_LINK_MESSAGE,
  HTML_PREVIEW_NATIVE_SANDBOX,
  HTML_PREVIEW_POLICY,
  MAX_TEXT_PREVIEW_BYTES,
  bucketFileViewerHeading,
  canPreviewFromText,
  getBucketPreviewKind,
  htmlPreviewDocument,
  htmlPreviewHasScripts,
  htmlPreviewHeldPolicy,
  htmlPreviewKey,
  htmlPreviewLinkFromBridge,
  htmlPreviewNavigation,
  htmlPreviewReadable,
  htmlPreviewSandboxes,
  htmlPreviewShell,
  htmlPreviewTitle,
  previewEncoding,
  readPreviewText,
} from './BucketFileViewer.shared';

const KEY = '0123456789abcdef0123456789abcdef';
const TOKEN = 'fedcba9876543210fedcba9876543210';

const scriptless = (html: string) =>
  htmlPreviewDocument(html, KEY, { scripts: 'none' });

// `html` as the document of an inline frame, `levels` frames deep.
function nested(html: string, levels: number): string {
  let doc = html;
  for (let level = 0; level < levels; level += 1) {
    doc = `<iframe srcdoc="${doc.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"></iframe>`;
  }
  return doc;
}

function directivesOf(policy: string) {
  return new Map(
    policy.split('; ').map((directive) => {
      const [name, ...sources] = directive.split(' ');
      return [name, sources] as const;
    })
  );
}

describe('getBucketPreviewKind', () => {
  it.each([
    ['photo.jpg', 'image/jpeg', 'image'],
    ['demo.mp4', 'video/mp4', 'video'],
    ['notes.md', undefined, 'text'],
    ['index.html', 'text/html', 'html'],
    ['page.htm', undefined, 'html'],
    // The upload fallback, as a file sent without a type arrives.
    ['export.html', 'application/octet-stream', 'html'],
    // With parameters, as a bot upload can record it.
    ['index', 'text/html; charset=utf-8', 'html'],
    ['notes.html', 'text/plain', 'html'],
    ['report.pdf', undefined, 'pdf'],
    // A rename changes the name, not the type: an explicit type other than
    // HTML or text wins over an .html name.
    ['renamed.html', 'application/pdf', 'pdf'],
    ['archive.zip', 'application/zip', 'unsupported'],
    ['bundle.html', 'application/zip', 'unsupported'],
  ] as const)('classifies %s (%s) as %s', (name, mimeType, expected) => {
    expect(getBucketPreviewKind({ name, mimeType })).toBe(expected);
  });
});

// A preview reads the whole object into memory, and the backend accepts up to
// 5 GiB, so size is the gate, HTML included; an unknown size is let through.
describe('canPreviewFromText', () => {
  it.each([
    ['export.csv', 'text/csv', MAX_TEXT_PREVIEW_BYTES, true],
    ['export.csv', 'text/csv', MAX_TEXT_PREVIEW_BYTES + 1, false],
    ['report.html', 'text/html', MAX_TEXT_PREVIEW_BYTES, true],
    ['report.html', 'text/html', MAX_TEXT_PREVIEW_BYTES + 1, false],
    ['dump.txt', undefined, 4 * 1024 * 1024 * 1024, false],
    ['notes.md', undefined, undefined, true],
    ['clip.mp4', 'video/mp4', undefined, false],
  ])('%s (%s, %s bytes): %s', (name, mimeType, size, expected) => {
    expect(canPreviewFromText({ name, mimeType, size })).toBe(expected);
  });
});

describe('readPreviewText', () => {
  const streamOf = (...chunks: (string | Uint8Array)[]) =>
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(
            typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk
          );
        }
        controller.close();
      },
    });
  // `café` in windows-1252, whose é UTF-8 cannot read.
  const cafe = new Uint8Array([0x63, 0x61, 0x66, 0xe9]);

  it('reads within the cap, and declines past it without reading the rest', async () => {
    expect(
      await readPreviewText(new Response(streamOf('<p>', 'héllo', '</p>')), {
        limit: 64,
      })
    ).toBe('<p>héllo</p>');

    // Declared over the cap: cancelled unread, or it could keep coming.
    let pulled = false;
    let cancelled = false;
    const declared = new ReadableStream(
      {
        pull() {
          pulled = true;
        },
        cancel() {
          cancelled = true;
        },
      },
      { highWaterMark: 0 }
    );
    expect(
      await readPreviewText(
        new Response(declared, { headers: { 'content-length': '65' } }),
        { limit: 64 }
      )
    ).toBeNull();
    expect({ pulled, cancelled }).toEqual({ pulled: false, cancelled: true });

    // Undeclared: stopped at the first byte past the cap.
    let sent = 0;
    cancelled = false;
    const endless = new ReadableStream<Uint8Array>({
      pull(controller) {
        sent += 1;
        controller.enqueue(new Uint8Array(32));
      },
      cancel() {
        cancelled = true;
      },
    });
    expect(
      await readPreviewText(new Response(endless), { limit: 64 })
    ).toBeNull();
    expect(cancelled).toBe(true);
    expect(sent).toBeLessThanOrEqual(4);
    // Past the cap it is declined, even when the body refuses to cancel.
    const stubborn = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new Uint8Array(32));
      },
      cancel() {
        throw new Error('cannot cancel');
      },
    });
    expect(
      await readPreviewText(new Response(stubborn), { limit: 64 })
    ).toBeNull();

    // A body that does not stream cannot be stopped, and a compressed one can
    // outgrow any declared length, so it is not read.
    let readWhole = false;
    const unstreamed = {
      arrayBuffer: () => {
        readWhole = true;
        return Promise.resolve(new ArrayBuffer(0));
      },
      body: null,
      headers: new Headers({ 'content-length': '5' }),
    } as unknown as Response;
    expect(await readPreviewText(unstreamed, { limit: 64 })).toBeNull();
    expect(readWhole).toBe(false);
  });

  it('decodes in the encoding the response or the page declares', async () => {
    expect(
      await readPreviewText(
        new Response(streamOf(cafe), {
          headers: { 'content-type': 'text/plain; charset=windows-1252' },
        })
      )
    ).toBe('café');
    const page = (html: boolean) =>
      readPreviewText(
        new Response(streamOf('<meta charset="windows-1252"><p>', cafe), {
          headers: { 'content-type': 'text/html' },
        }),
        { html }
      );
    expect(await page(true)).toBe('<meta charset="windows-1252"><p>café');
    // A text file's contents declare nothing.
    expect(await page(false)).toContain('caf�');
  });

  describe('where the runtime decodes only UTF-8, as on Expo', () => {
    const RealTextDecoder = TextDecoder;
    class Utf8OnlyDecoder {
      private decoder: TextDecoder;
      constructor(label = 'utf-8') {
        if (!/^(utf-?8|unicode-1-1-utf-8)$/i.test(label)) {
          throw new RangeError(`Unknown encoding: ${label}`);
        }
        this.decoder = new RealTextDecoder('utf-8');
      }
      decode(input: Uint8Array) {
        return this.decoder.decode(input);
      }
    }
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('decodes windows-1252 and UTF-16 itself, and declines what it cannot decode', async () => {
      vi.stubGlobal('TextDecoder', Utf8OnlyDecoder);
      const euro = new Uint8Array([0x20, 0x80, 0x20, 0x93, 0x71, 0x94]);
      for (const charset of ['windows-1252', 'iso-8859-1', 'latin1']) {
        const response = new Response(streamOf(cafe, euro), {
          headers: { 'content-type': `text/plain; charset=${charset}` },
        });
        expect(await readPreviewText(response), charset).toBe('café € “q”');
      }
      const text = '<p>café ✓</p>';
      const units = [...text].map((char) => char.charCodeAt(0));
      for (const bytes of [
        [0xff, 0xfe, ...units.flatMap((u) => [u & 0xff, u >> 8])],
        [0xfe, 0xff, ...units.flatMap((u) => [u >> 8, u & 0xff])],
      ]) {
        const response = new Response(streamOf(new Uint8Array(bytes)));
        expect(await readPreviewText(response, { html: true })).toBe(text);
      }
      // A valid encoding it cannot decode would come out garbled as UTF-8, so
      // the preview is declined, and Open shows the file.
      const shiftJis = new Response(streamOf('plain ascii'), {
        headers: { 'content-type': 'text/plain; charset=shift_jis' },
      });
      expect(await readPreviewText(shiftJis)).toBeNull();
      const cyrillic = new Response(
        streamOf('<meta charset="windows-1251"><p>x</p>')
      );
      expect(await readPreviewText(cyrillic, { html: true })).toBeNull();
      // Whether a label names an encoding does not depend on the runtime.
      expect(
        previewEncoding({
          contentType: 'text/html; charset=Shift_JIS',
          head: '<meta charset="windows-1252">',
          html: true,
        })
      ).toBe('shift_jis');
      expect(
        previewEncoding({
          head: '<meta charset="gbk"><meta charset="windows-1252">',
          html: true,
        })
      ).toBe('gbk');
    });
  });
});

describe('previewEncoding', () => {
  // prettier-ignore
  it.each([
    // A byte order mark first, then the response's charset, read parameter by
    // parameter; a label that names no encoding says nothing.
    ['ï»¿<meta charset="windows-1252">', 'text/html; charset=shift_jis', 'utf-8'],
    ['ÿþ<\u0000', undefined, 'utf-16le'],
    ['þÿ\u0000<', undefined, 'utf-16be'],
    ['<meta charset="windows-1252">', 'text/html; charset="Shift_JIS"', 'shift_jis'],
    ['<p>x</p>', 'text/html; note="x; charset=windows-1252"; charset=utf-8', 'utf-8'],
    ['<p>x</p>', 'text/html;charset="windows\\-1252"', 'windows-1252'],
    ['<meta charset="windows-1252">', 'text/html; charset=bogus', 'windows-1252'],
    // Then a genuine <meta>, as the prescan reads one: http-equiv must be
    // content-type itself, and only ASCII whitespace or the vertical tab,
    // which Chromium and WebKit both accept, may surround charset's `=`.
    ['<!doctype html><meta charset=windows-1252>', undefined, 'windows-1252'],
    ['<meta http-equiv="Content-Type" content="text/html; charset=ISO-8859-1">', undefined, 'windows-1252'],
    ['<meta content="text/html; charset=windows-1252" http-equiv="Content-Type">', undefined, 'windows-1252'],
    ['<meta http-equiv="Content-Type" content="text/html; charset = windows-1252">', undefined, 'windows-1252'],
    ['<meta http-equiv="content-type" content="text/html; charset\u000b=windows-1252">', undefined, 'windows-1252'],
    ['<meta http-equiv="content-type" content="text/html; charset =windows-1252">', undefined, 'utf-8'],
    ['<meta http-equiv=" content-type " content="text/html; charset=windows-1252">', undefined, 'utf-8'],
    ['<meta charset = " windows-1252 ">', undefined, 'windows-1252'],
    ['<!-- charset=windows-1252 --><p>x</p>', undefined, 'utf-8'],
    ['<meta name="description" content="charset=windows-1252">', undefined, 'utf-8'],
    ['<meta http-equiv="refresh" content="0; charset=windows-1252">', undefined, 'utf-8'],
    ['<!-- <meta charset="shift_jis"> --><meta charset="windows-1252">', undefined, 'windows-1252'],
    ['<meta charset="x-invalid"><meta charset="windows-1252">', undefined, 'windows-1252'],
    ['<meta http-equiv="Content-Type" content="text/html; charset=bogus"><meta charset="iso-8859-2">', undefined, 'iso-8859-2'],
    // A charset attribute, even an empty one, stops its meta's pragma.
    ['<meta charset="" http-equiv="content-type" content="text/html; charset=windows-1251"><meta charset="iso-8859-2">', undefined, 'iso-8859-2'],
    ['<meta http-equiv="content-type" content="text/html; charset=windows-1251" charset><meta charset="iso-8859-2">', undefined, 'iso-8859-2'],
    // A label resolves to its encoding, as the Encoding Standard lists them;
    // UTF-16 named in ASCII markup is UTF-8.
    ['<meta charset=" Latin1 ">', undefined, 'windows-1252'],
    ['<meta charset="us-ascii">', undefined, 'windows-1252'],
    ['<meta charset="cp1251">', undefined, 'windows-1251'],
    ['<meta charset="x-sjis">', undefined, 'shift_jis'],
    ['<meta charset="x-user-defined">', undefined, 'windows-1252'],
    ['<meta charset="utf-16">', undefined, 'utf-8'],
    ['<meta charset="unicode">', undefined, 'utf-8'],
    ['<meta charset="csunicode">', undefined, 'utf-8'],
    ['<meta charset="ucs-2">', undefined, 'utf-8'],
    ['<meta charset="unicodefffe">', undefined, 'utf-8'],
    // Then an XML declaration at the very start.
    ['<?xml version="1.0" encoding="windows-1252"?><p>x</p>', undefined, 'windows-1252'],
    ["<?xml encoding = 'ISO-8859-2' ?><p>x</p>", undefined, 'iso-8859-2'],
    ['<?xml encoding="windows-1252"?><meta charset="iso-8859-2">', undefined, 'iso-8859-2'],
    [' <?xml encoding="windows-1252"?><p>x</p>', undefined, 'utf-8'],
    ['<?xml version="1.0"?><p>encoding="windows-1252"</p>', undefined, 'utf-8'],
    ['<?xml version="1.0" encoding="UTF-16"?><p>x</p>', undefined, 'utf-8'],
    ['<?xml version="1.0" encoding="bogus"?><p>x</p>', undefined, 'utf-8'],
    // Any start of `<?xml`, as Chromium and WebKit read it, but in lowercase,
    // with a quoted value.
    ['<?xml-stylesheet encoding="windows-1251"?><p>x</p>', undefined, 'windows-1251'],
    ['<?XML encoding="windows-1251"?><p>x</p>', undefined, 'utf-8'],
    ['<?xml encoding=windows-1251?><p>x</p>', undefined, 'utf-8'],
    ['<\u0000?\u0000x\u0000m\u0000l\u0000', undefined, 'utf-16le'],
    ['\u0000<\u0000?\u0000x\u0000m\u0000l', undefined, 'utf-16be'],
    // Otherwise UTF-8.
    ['<p>no declaration</p>', undefined, 'utf-8'],
    [`${' '.repeat(1024)}<meta charset="windows-1252">`, undefined, 'utf-8'],
  ])('%j (%s) is %s', (head, contentType, expected) => {
    expect(previewEncoding({ contentType, head, html: true })).toBe(expected);
  });

  it('reads no declaration in plain text', () => {
    expect(
      previewEncoding({ head: '<meta charset="windows-1252">', html: false })
    ).toBe('utf-8');
  });
});

describe('htmlPreviewTitle', () => {
  // prettier-ignore
  it.each([
    ['<!doctype html><title>\n  Launch &amp; recap &#x2014; Q3  </title>', 'Launch & recap — Q3'],
    // Collapsed as document.title does: ASCII whitespace only.
    ['<title>\n A&nbsp;&nbsp;B \t</title>', 'A  B'],
    // HTML5's references; legacy names need no semicolon and match their
    // longest prefix; C1 numbers are windows-1252, and zero, a surrogate or
    // past Unicode the replacement character.
    ['<title>&copy;&Alpha;&hearts;&euro;&hellip;&lang;&AMP;</title>', '©Α♥€…⟨&'],
    ['<title>Status &check; &bigstar; &copy 2026 &notit;</title>', 'Status ✓ ★ © 2026 ¬it;'],
    ['<title>a&#150;b&#x0;&#xD800;&#1114112; &bogus; &amp</title>', 'a–b��� &bogus; &'],
    // Not one the parser makes no element of, or that is not the document's.
    ['<!-- <title>draft</title> --><svg><title>icon</title></svg><title>Report</title>', 'Report'],
    [`<script>'<title>a</title>'</script><style>/* <title>b</title> */</style><template><title>c</title></template><textarea><title>d</title></textarea><div data-x="a>b<title>e</title>"></div><TITLE>Final</TITLE>`, 'Final'],
    ['<template><template></template><title>Draft</title></template><title>Final</title>', 'Final'],
    ['<svg><svg></svg><title>Icon</title></svg><svg/><title>Final</title>', 'Final'],
    ['<p>İİİ</p><title>Title</title>', 'Title'],
    ['<!--><title>Title</title><!-- -->', 'Title'],
    // Foreign content, as the tree builder reads it.
    ['<svg><p></p><title>Real</title>', 'Real'],
    ['<svg/><title>Page</title>', 'Page'],
    ['<svg data=x/><title>Drawing</title></svg><title>Page</title>', 'Page'],
    ['<svg><foreignObject><title>Page</title></foreignObject></svg>', 'Page'],
    ['<svg><foreignObject><textarea><title>Fake</title></textarea></foreignObject></svg><title>Real</title>', 'Real'],
    ['<svg><g><svg></g></svg><title>Page</title>', 'Page'],
    ['<math><annotation-xml><svg><foreignObject><title>Page</title></foreignObject></svg></annotation-xml></math>', 'Page'],
    ['<math><annotation-xml encoding="text&#47;html"><title>Page</title></annotation-xml></math>', 'Page'],
    ['<math><mi><mglyph><title>Fake</title></mglyph></mi></math><title>Real</title>', 'Real'],
    ['<template><svg><template></template></svg><title>Draft</title></template><title>Final</title>', 'Final'],
    ['<template><svg></template><title>Real</title>', 'Real'],
    ['<template><svg><foreignObject></template></foreignObject><title>After</title>', 'After'],
    // A script ends through its escape states.
    ['<script><!--<script></script><title>Fake</title>--></script><title>Real</title>', 'Real'],
    ['<script><!-- </script><title>Escaped end</title>', 'Escaped end'],
    ['<script><!--></script><title>Short comment</title>', 'Short comment'],
    // A title never closed runs to the end of the file.
    ['<title>Unclosed', 'Unclosed'],
    ['<title>Notes &amp; more<p>body', 'Notes & more<p>body'],
    // None.
    ['<p>hi</p>', undefined],
    ['<title>  </title>', undefined],
    ['<title>   ', undefined],
    ['<plaintext><title>Text</title>', undefined],
    ['<noscript><title>Offline</title></noscript>', undefined],
  ])('reads %j as %j', (html, expected) => {
    expect(htmlPreviewTitle(html)).toBe(expected);
  });

  // Where no script runs, as under Electron, a noscript holds markup.
  it('reads a title in noscript in a frame without scripts', () => {
    expect(
      htmlPreviewTitle('<noscript><title>Offline</title></noscript>', {
        scripting: false,
      })
    ).toBe('Offline');
  });
});

describe('bucketFileViewerHeading', () => {
  it('names a rendered page by its title, and anything else by its name', () => {
    const file = {
      name: 'report.html',
      mimeType: 'text/html',
      sizeLabel: '4 KB',
    };
    expect(
      bucketFileViewerHeading({
        ...file,
        textContent: '<title>Numbers</title>',
      })
    ).toEqual({ subtitle: 'report.html · 4 KB', title: 'Numbers' });
    for (const textContent of [undefined, '<p>untitled</p>']) {
      expect(bucketFileViewerHeading({ ...file, textContent })).toEqual({
        subtitle: '4 KB',
        title: 'report.html',
      });
    }
    expect(
      bucketFileViewerHeading({
        name: 'notes.md',
        textContent: '<title>x</title>',
      })
    ).toEqual({ subtitle: 'File', title: 'notes.md' });
  });
});

describe('htmlPreviewSandboxes', () => {
  // Never the app's origin, forms, dialogs or the top. The file's frame opens
  // no window, which it could with no tap; under Electron, where web security
  // is off, neither frame runs a script.
  it('grants scripts or popups by mode, and nothing more', () => {
    const scripted = {
      document: 'allow-scripts',
      shell: 'allow-scripts allow-popups allow-popups-to-escape-sandbox',
    };
    const popups = 'allow-popups allow-popups-to-escape-sandbox';
    expect(htmlPreviewSandboxes({ scripts: 'all' })).toEqual(scripted);
    expect(htmlPreviewSandboxes({ scripts: 'ours' })).toEqual(scripted);
    expect(htmlPreviewSandboxes({ scripts: 'none' })).toEqual({
      document: popups,
      shell: popups,
    });
    expect(HTML_PREVIEW_NATIVE_SANDBOX).toBe('allow-scripts');
  });
});

describe('htmlPreviewHasScripts', () => {
  it.each([
    '<script>go()</script>',
    '<SCRIPT src="https://cdn.jsdelivr.net/npm/x.js"></SCRIPT>',
    // An address the policy lets a script load from: a script CDN, directly
    // or under the file's base, which a frame's document inherits, or data.
    '<base href="https://unpkg.com/x/"><script src="lib.js"></script>',
    '<base href="https://cdn.jsdelivr.net/npm/"><iframe srcdoc="<script src=x.js></script>"></iframe>',
    '<script src="data:text/javascript,go()"></script>',
    '<svg><script href="https://code.jquery.com/x.js"></script></svg>',
    '<button onclick="go()">go</button>',
    '<svg onload = "go()"></svg>',
    '<a href="javascript:go()">go</a>',
    '<a href="java&#x73;cript:go()">go</a>',
    '<a href="java\tscript:go()">go</a>',
    '<a href=" JAVASCRIPT:go()">go</a>',
    '<iframe srcdoc="&lt;script&gt;go()&lt;/script&gt;"></iframe>',
    '<iframe sandbox="allow-popups ALLOW-SCRIPTS" srcdoc="&lt;script&gt;go()&lt;/script&gt;"></iframe>',
    '<p>İİİ</p><script>go()</script>',
    '<a data=x=" onclick=go()>x</a>',
    '<!--><script>go()</script><!-- -->',
    // In an svg a title or style holds markup.
    '<svg><title><script>run()</script></title></svg>',
    '<svg><style><a onclick="go()">x</a></style></svg>',
    '<svg data=x/><title><script>run()</script></title></svg>',
    // WebKit ignores a text element's start tag inside a select.
    '<select><iframe><script>run()</script></iframe></select>',
    '<select><style><script>run()</script></style></select>',
    '<select><xmp><script>run()</script></xmp></select>',
    // A script runs when its type, or without one an HTML script's language,
    // names JavaScript or a module. The standard trims a module type too, and
    // Chromium a vertical tab.
    '<script type=" TEXT/JavaScript ">go()</script>',
    '<script type="text&#47;javascript">go()</script>',
    '<script type="" language="vbscript">go()</script>',
    '<script language="JavaScript">go()</script>',
    '<script type="module">go()</script>',
    '<script type=" module ">go()</script>',
    '<script type="\u000btext/javascript">go()</script>',
    '<svg><script type="text/ecmascript">go()</script></svg>',
    '<svg><script language="vbscript">go()</script></svg>',
    '<script type="application/ld+json">{}</script><script>go()</script>',
    // A browser that runs modules skips a classic HTML script marked
    // nomodule, but not a module or an SVG script.
    '<script type="module" nomodule>go()</script>',
    '<svg><script nomodule>go()</script></svg>',
    // HTML at a MathML integration point, and SVG inside an annotation-xml.
    '<math><mi><script>go()</script></mi></math>',
    '<math><annotation-xml encoding="text/html"><script>go()</script></annotation-xml></math>',
    '<math><annotation-xml><svg><script>go()</script></svg></annotation-xml></math>',
    // A declarative shadow root's content is live, and an svg's template is
    // SVG's.
    '<div><template shadowrootmode="open"><script>go()</script></template></div>',
    '<div><template shadowrootmode="CLOSED"><iframe srcdoc="&lt;script&gt;go()&lt;/script&gt;"></iframe></template></div>',
    '<x-é><template shadowrootmode="open"><script>go()</script></template></x-é>',
    '<svg><template><script>go()</script></template></svg>',
    '<template></template><script>go()</script>',
    // A template's end tag closes it from inside foreign content too, unless
    // a foreign template is open within it; so does an HTML element's end tag
    // the element it names, with the svg or math inside.
    '<template><svg></template></svg><script>go()</script>',
    '<template><math><mi><svg></template><script>go()</script>',
    '<div><math></div><script>go()</script>',
    '<table><tr><td><math></td></tr></table><script>go()</script>',
    // Where a javascript: URL runs: a link, an SVG link by either attribute,
    // a MathML href (WebKit), an inline frame (Chromium).
    '<area href="javascript:go()">',
    '<svg><a xlink:href="javascript:go()"><text>x</text></a></svg>',
    '<math><mtext href="javascript:go()">x</mtext></math>',
    '<iframe src="javascript:go()"></iframe>',
    // A handler only one engine has: WebKit's focusin and iOS's video
    // fullscreen, Chromium's SVG begin and validationstatuschange, and a
    // window event <body> forwards.
    '<div onfocusin="go()">x</div>',
    '<video controls onwebkitbeginfullscreen="go()"></video>',
    '<svg><animate onbegin="go()"/></svg>',
    '<div onvalidationstatuschange="go()">x</div>',
    '<body ononline="go()">',
    // A handler only some elements take, on one that does: the window's on
    // <body>, <frameset> or (unload) an <svg>, an input's search, a media
    // element's own.
    '<frameset onpagehide="go()"></frameset>',
    '<svg onunload="go()"></svg>',
    '<input type="search" onsearch="go()">',
    '<video onencrypted="go()"></video>',
    // Nested deeper than it reads.
    nested('<p>static</p>', 4),
  ])('finds a script in %j', (html) => {
    expect(htmlPreviewHasScripts(html)).toBe(true);
  });

  it.each([
    '<p>A page about online scripts.</p><a href="x">x</a>',
    '<abbr title="javascript: a language">JS</abbr>',
    '<style>a::after { content: "<script>"; }</style>',
    '<iframe><script>run()</script></iframe>',
    '<select></select><xmp><script>run()</script></xmp>',
    '<svg><foreignObject><textarea><script>go()</script></textarea></foreignObject></svg>',
    '<math><mi><textarea><script>go()</script></textarea></mi></math>',
    '<svg><p><textarea><script>go()</script></textarea>',
    // A data block, which the browser keeps as text, whatever it holds.
    '<script type="application/ld+json">{"@type": "Article"}</script>',
    '<script type="application&#47;ld+json">{}</script>',
    '<script type="text/plain"><!--<script>go()</script>--></script>',
    '<script type="text/javascript; charset=utf-8">go()</script>',
    '<script type="javascript">go()</script>',
    '<script type=" ">go()</script>',
    '<script type="importmap">{}</script>',
    '<script type="speculationrules">{}</script>',
    '<script language="vbscript">go()</script>',
    '<script type="text/plain" type="text/javascript">go()</script>',
    '<svg><script type="application/ld+json">{}</script></svg>',
    '<script nomodule>go()</script>',
    '<script type="text/javascript" NOMODULE>go()</script>',
    // A MathML script element is never run.
    '<math><script>go()</script></math>',
    '<math><annotation-xml><script>go()</script></annotation-xml></math>',
    // An ordinary template's content is inert, in a shadow root or around one.
    '<template><script>go()</script><button onclick="go()">x</button><a href="javascript:go()">x</a><iframe srcdoc="&lt;script&gt;go()&lt;/script&gt;"></iframe></template>',
    '<div><template shadowrootmode="open"><template><script>go()</script></template></template></div>',
    '<template><div><template shadowrootmode="open"><script>go()</script></template></div></template>',
    '<div><template shadowrootmode=" open"><script>go()</script></template></div>',
    // A shadow root on a host that cannot take one, or a host's second,
    // stays an ordinary template.
    '<ul><template shadowrootmode="open"><script>go()</script></template></ul>',
    '<template shadowrootmode="open"><script>go()</script></template>',
    '<div><template shadowrootmode="open"></template><template shadowrootmode="open"><script>go()</script></template></div>',
    '<x-@><template shadowrootmode="open"><script>go()</script></template></x-@>',
    '<x-×><template shadowrootmode="open"><script>go()</script></template></x-×>',
    // Chromium and WebKit run this script, but parse5 drops what follows an
    // HTML template closed inside an SVG template's foreignObject: it takes
    // the SVG element for an HTML template when it resets its mode.
    '<svg><template><foreignObject><template></template><script>go()</script></foreignObject></template></svg>',
    '<svg><foreignObject><template></foreignObject><script>go()</script></template></foreignObject></svg>',
    // A javascript: URL where none runs: a form cannot submit, an object or
    // embed cannot load, and other elements fetch theirs.
    '<div href="javascript:go()">x</div><a xlink:href="javascript:go()">x</a>',
    '<form action="javascript:go()"><button formaction="javascript:go()">Go</button></form>',
    '<object data="javascript:go()"></object><embed src="javascript:go()"><img src="javascript:go()">',
    // An attribute that only starts like a handler, and a srcdoc on anything
    // but an iframe.
    '<div only="true" one="1" onward="x">x</div>',
    // An address the policy refuses -- another host, http, a relative one
    // with no web base -- or none at all; the element's own text never runs.
    '<script src="https://example.com/app.js">go()</script>',
    '<script src="http://cdn.jsdelivr.net/x.js"></script><script src="x.js"></script><script src="">go()</script>',
    '<svg><script href="https://example.com/x.js" xlink:href="https://cdn.jsdelivr.net/x.js">go()</script></svg>',
    // A handler only some elements take, on one that does not.
    '<div onbegin="go()" ononline="go()">x</div><span onsearch="go()" onencrypted="go()"></span><svg><g onunload="go()"/></svg>',
    '<div srcdoc="&lt;script&gt;go()&lt;/script&gt;">x</div>',
    nested('<p>static</p>', 3),
    // A frame whose own sandbox keeps it from scripts runs none, nor does
    // any frame inside it.
    '<iframe sandbox srcdoc="&lt;script&gt;go()&lt;/script&gt;&lt;a href=&quot;javascript:go()&quot;&gt;x&lt;/a&gt;"></iframe>',
    `<iframe sandbox="allow-popups" srcdoc="${nested('<script>go()</script>', 4).replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"></iframe>`,
  ])('finds none in %j', (html) => {
    expect(htmlPreviewHasScripts(html)).toBe(false);
  });
});

describe('the preview policies', () => {
  // A ship would answer as the reader (`/~/logout` is a GET), and no source
  // list can exclude one host, so only what can never be a ship may load.
  it('load nothing a ship or an author could serve, and allow no connection, form, object or outside frame', () => {
    const running = directivesOf(HTML_PREVIEW_POLICY);
    expect(running.get('default-src')).toEqual(["'none'"]);
    for (const name of ['connect-src', 'form-action', 'object-src']) {
      expect(running.get(name), name).toEqual(["'none'"]);
    }
    expect(running.get('frame-src')).toEqual(['about:']);
    const allowed = new Set([
      "'none'",
      "'unsafe-inline'",
      "'unsafe-eval'",
      'data:',
      'blob:',
      'about:',
      'https://cdnjs.cloudflare.com',
      'https://cdn.jsdelivr.net',
      'https://unpkg.com',
      'https://cdn.tailwindcss.com',
      'https://code.jquery.com',
      'https://fonts.googleapis.com',
      'https://fonts.gstatic.com',
    ]);
    for (const [name, sources] of running) {
      for (const source of sources) {
        expect(allowed.has(source), `${name} ${source}`).toBe(true);
      }
    }
  });

  it("hold a page's scripts by nonce, under the same loads and limits", () => {
    const held = directivesOf(htmlPreviewHeldPolicy(TOKEN));
    expect(held.get('script-src')).toEqual([`'nonce-${TOKEN}'`]);
    expect(held.has('worker-src')).toBe(false);
    held.delete('script-src');
    const running = directivesOf(HTML_PREVIEW_POLICY);
    running.delete('script-src');
    running.delete('worker-src');
    expect(held).toEqual(running);
  });
});

describe('htmlPreviewShell', () => {
  const file = '<!doctype html><p class="x">a & b</p><script>alert(1)</script>';
  const shell = (
    opener: Parameters<typeof htmlPreviewShell>[0]['opener'],
    nonce?: string
  ) =>
    htmlPreviewShell({
      document: file,
      key: KEY,
      nonce,
      opener,
      sandbox: 'allow-scripts',
    });

  // The file's document inherits the policy from here, where its markup cannot
  // reach. Without a viewport, iOS lays the file out at desktop width.
  it('holds the file, escaped, in a sandboxed frame under its policy, with one script of its own after it', () => {
    const web = shell({ kind: 'window' });
    expect(web).toContain(
      `<meta http-equiv="Content-Security-Policy" content="${HTML_PREVIEW_POLICY}">`
    );
    expect(web.indexOf('Content-Security-Policy')).toBeLessThan(
      web.indexOf('</head>')
    );
    expect(shell({ kind: 'app', token: TOKEN })).toContain(
      '<meta name="viewport" content="width=device-width, initial-scale=1">'
    );
    expect(web).toContain(
      '<iframe sandbox="allow-scripts" srcdoc="&lt;!doctype html&gt;&lt;p class=&quot;x&quot;&gt;a &amp; b&lt;/p&gt;&lt;script&gt;alert(1)&lt;/script&gt;"></iframe>'
    );
    expect(web.match(/<script/g)).toHaveLength(1);
    expect(web.indexOf('<script')).toBeGreaterThan(web.indexOf('</iframe>'));

    const held = shell({ kind: 'window' }, TOKEN);
    expect(held).toContain(
      `<meta http-equiv="Content-Security-Policy" content="${htmlPreviewHeldPolicy(TOKEN)}">`
    );
    expect(held.match(/<script/g)).toHaveLength(1);
    expect(held).toContain(`<script nonce="${TOKEN}">`);
  });

  // From the file's frame, with the key, on a tap, to a web, mail or phone
  // address: as a new tab on web, through the app with its token on native.
  it('opens a link only when every check passes', () => {
    const web = shell({ kind: 'window' });
    for (const check of [
      'event.source !== frame.contentWindow',
      `data.type !== '${HTML_PREVIEW_LINK_MESSAGE}'`,
      'data.key !== key',
      'navigator.userActivation',
      '!activation.isActive',
      '/^(https?|mailto|tel):$/.test(url.protocol)',
      `})('${KEY}', function (href)`,
      "window.open(href, '_blank', 'noopener,noreferrer')",
    ]) {
      expect(web).toContain(check);
    }
    expect(web).not.toContain('ReactNativeWebView');
    const native = shell({ kind: 'app', token: TOKEN });
    expect(native).toContain('window.ReactNativeWebView.postMessage(');
    expect(native).toContain(`token: '${TOKEN}'`);
    expect(native).not.toContain('window.open(');
  });
});

describe('htmlPreviewDocument', () => {
  const lead = `<meta http-equiv="Content-Security-Policy" content="${HTML_PREVIEW_POLICY}"><base target="_blank"><script>`;

  // After the doctype, or the page goes quirks, past any comment tokens ahead
  // of it as the tokenizer ends them; first when a file's script could run
  // before it.
  // prettier-ignore
  it.each([
    ['<!doctype html><p>x</p>', '<!doctype html>'],
    ['<!DOCTYPE html>\n<html><body>b</body></html>', '<!DOCTYPE html>'],
    ['<p>hi</p>', ''],
    ['﻿  <!doctype html><p>x</p>', '﻿  <!doctype html>'],
    ['<!-- generated -->\n<!DOCTYPE html>\n<p>x</p>', '<!-- generated -->\n<!DOCTYPE html>'],
    ['<?xml version="1.0"?>\n<!DOCTYPE html>\n<p>x</p>', '<?xml version="1.0"?>\n<!DOCTYPE html>'],
    ['<!---- a -- b ----><!DOCTYPE html><p>x</p>', '<!---- a -- b ----><!DOCTYPE html>'],
    ['<!foo><!DOCTYPE html><p>x</p>', '<!foo><!DOCTYPE html>'],
    ['</ x><!DOCTYPE html><p>x</p>', '</ x><!DOCTYPE html>'],
    ['<![CDATA[x]]><!DOCTYPE html><p>x</p>', '<![CDATA[x]]><!DOCTYPE html>'],
    // A `>` ends a doctype even inside a quoted identifier.
    ['<!DOCTYPE html SYSTEM "a>b"><p>x</p>', '<!DOCTYPE html SYSTEM "a>'],
    ['<!--><script>first()</script><!-- --><!DOCTYPE html><p>x</p>', ''],
    ['<!---><script>first()</script><!-- --><!DOCTYPE html><p>x</p>', ''],
    ['<!-- --!><script>first()</script><!-- --><!DOCTYPE html><p>x</p>', ''],
  ])('places ours in %j after %j', (file, before) => {
    const out = htmlPreviewDocument(file, KEY);
    expect(out.startsWith(before + lead)).toBe(true);
    expect(out.endsWith(`</script>${file.slice(before.length)}`)).toBe(true);
  });

  it('gives our script the key, removes it, keeps a clicked link off the frame, and follows only trusted, uncancelled clicks', () => {
    const out = htmlPreviewDocument('<p>x</p>', KEY);
    for (const part of [
      `})('${KEY}', true);`,
      'document.currentScript',
      'self.remove()',
      'event.isTrusted',
      'if (event.defaultPrevented) return;',
      'new Observer(aim)',
      'var result = evaluate(code);',
    ]) {
      expect(out).toContain(part);
    }
  });

  // Held, the browser parses the file as it is and runs only our script.
  it("holds the file's scripts by nonce, ours alone, with no javascript: link", () => {
    const file =
      '<p><a href="tlon://open" onclick="go()">x</a></p><script>go()</script>';
    const out = htmlPreviewDocument(`<!doctype html>${file}`, KEY, {
      scripts: 'ours',
      nonce: TOKEN,
    });
    expect(
      out.startsWith(
        `<!doctype html><meta http-equiv="Content-Security-Policy" content="${htmlPreviewHeldPolicy(TOKEN)}"><base target="_blank"><script nonce="${TOKEN}">`
      )
    ).toBe(true);
    expect(out.endsWith(`</script>${file}`)).toBe(true);
    expect(out.match(/<script nonce=/g)).toHaveLength(1);
    expect(out).toContain(`})('${KEY}', false);`);
    expect(out).toContain(
      'if (!runsJavascriptLinks || link.namespaceURI === MATHML) return;'
    );
  });

  // They are written in as text, where a slip in an escape would break every
  // preview silently.
  it('carries scripts that parse', () => {
    const scripts = [
      htmlPreviewDocument('<p>x</p>', KEY),
      htmlPreviewDocument('<p>x</p>', KEY, { scripts: 'ours', nonce: TOKEN }),
      ...([{ kind: 'window' }, { kind: 'app', token: TOKEN }] as const).map(
        (opener) =>
          htmlPreviewShell({
            document: '',
            key: KEY,
            opener,
            sandbox: 'allow-scripts',
          })
      ),
    ].map((doc) => {
      const open = doc.lastIndexOf('<script');
      return doc.slice(
        doc.indexOf('>', open) + 1,
        doc.indexOf('</script>', open)
      );
    });
    for (const script of scripts) {
      expect(() => new Function(script)).not.toThrow();
    }
  });
});

// Under Electron no script runs in the frame, so the markup itself aims every
// link at _blank, and a popup escaping the sandbox may carry only a web, mail
// or phone address, computed here.
describe('htmlPreviewDocument without scripts', () => {
  // prettier-ignore
  it.each([
    ['<a href="https://a.example" target="_self">a</a>', '<a target="_blank" href="https://a.example/">a</a>'],
    ['<A HREF=https://b.example TARGET=_top>b</A>', '<A target="_blank" href="https://b.example/">b</A>'],
    ["<map><area href=\"mailto:c@example.com\" target='_parent'></map>", '<area target="_blank" href="mailto:c@example.com">'],
    ['<a href="tel:+15555550100">d</a>', '<a target="_blank" href="tel:+15555550100">d</a>'],
    ['<svg><a xlink:href="https://e.example"><text>e</text></a></svg>', '<a target="_blank" href="https://e.example/">'],
    ['<a title="target=_self" href="https://x.example">x</a>', '<a target="_blank" href="https://x.example/" title="target=_self">'],
    // Any other scheme loses its address; xlink:href is one only on SVG.
    ['<a href="data:text/html,<b>x</b>" class="d">d</a>', '<a target="_blank" class="d">d</a>'],
    ['<a href="java&#x73;cript:go()" class="j">j</a>', '<a target="_blank" class="j">j</a>'],
    ['<a href=" FILE:///etc/passwd" class="f">f</a>', '<a target="_blank" class="f">f</a>'],
    ['<a href="zoommtg://join" class="z">z</a>', '<a target="_blank" class="z">z</a>'],
    ['<a xlink:href="https://example.com">text</a>', '<a target="_blank">text</a>'],
    // A fragment stays in the file. Left to the browser, a relative address
    // would resolve against the reader's ship, so it needs a usable web base
    // of the file's own.
    ['<a href="#bottom">b</a>', '<a target="_self" href="about:srcdoc#bottom">b</a>'],
    ['<a href="">top</a>', '<a target="_self" href="about:srcdoc#">top</a>'],
    ['<a href="help.html">h</a>', '<a target="_blank">h</a>'],
    ['<a href="//cdn.example/x">x</a>', '<a target="_blank" href="https://cdn.example/x">x</a>'],
    ['<a href="https:/~/logout">x</a>', '<a target="_blank" href="https://~/logout">x</a>'],
    ['<base href="https://docs.example/guide/"><a href="help.html">h</a>', '<a target="_blank" href="https://docs.example/guide/help.html">h</a>'],
    ['<base href="https://docs.example/guide/"><a href="#s">s</a>', '<a target="_blank" href="https://docs.example/guide/#s">s</a>'],
    ['<base href="https://docs.example/guide/"><a href="//cdn.example/x">x</a>', '<a target="_blank" href="https://cdn.example/x">x</a>'],
    ['<base href="https://docs.example/guide/"><a href="https:help">h</a>', '<a target="_blank" href="https://docs.example/guide/help">h</a>'],
    ['<base href="https://docs.example/guide/"><a href="https:/path">p</a>', '<a target="_blank" href="https://docs.example/path">p</a>'],
    ['<base href="//docs.example/guide/"><a href="help.html">h</a>', '<a target="_blank" href="https://docs.example/guide/help.html">h</a>'],
    ['<svg><foreignObject><base href="https://docs.example/"><a href="help">Help</a></foreignObject></svg>', '<a target="_blank" href="https://docs.example/help">Help</a>'],
    ['<svg/><template></template><base href="https://t.example/"><a href="help.html">x</a>', '<a target="_blank" href="https://t.example/help.html">x</a>'],
    ['<base href="data:text/html,x"><a href="help.html">h</a>', '<a target="_blank">h</a>'],
    ['<base href="http:"><a href="/~/logout">x</a>', '<a target="_blank">x</a>'],
    ['<base href="https://exa mple.com/"><a href="/~/logout">x</a>', '<a target="_blank">x</a>'],
    ['<base href="/docs/"><a href="/~/logout">x</a>', '<a target="_blank">x</a>'],
    ['<template><base href="https://t.example/"></template><a href="help.html">x</a>', '<a target="_blank">x</a>'],
    ['<svg><base href="https://t.example/"/></svg><a href="help.html">x</a>', '<a target="_blank">x</a>'],
    ['<math><base href="https://t.example/"></base></math><a href="help.html">x</a>', '<a target="_blank">x</a>'],
    // Electron's parser, like WebKit's, drops a base inside a select.
    ['<select><base href="https://t.example/"></select><a href="help.html">x</a>', '<a target="_blank">x</a>'],
    // An input closes the select, so a base after it is the document's.
    ['<select><input><base href="https://t.example/"><a href="help.html">x</a>', '<a target="_blank" href="https://t.example/help.html">x</a>'],
    // A frame's document inherits the base set by the time the parser reached
    // the frame, which its own base resolves against, or replaces.
    ['<base href="https://docs.example/guide/"><iframe srcdoc="<a href=help>h</a>"></iframe>', 'href=&quot;https://docs.example/guide/help&quot;'],
    ['<iframe srcdoc="<a href=help>h</a>"></iframe><base href="https://late.example/">', 'srcdoc="&lt;a target=&quot;_blank&quot;&gt;h&lt;/a&gt;"'],
    ['<base href="https://docs.example/guide/"><iframe srcdoc="<base href=sub/><a href=help>h</a>"></iframe>', 'href=&quot;https://docs.example/guide/sub/help&quot;'],
    ['<base href="https://docs.example/guide/"><iframe srcdoc="<base href=data:,x><a href=help>h</a>"></iframe>', 'href=&quot;https://docs.example/guide/help&quot;'],
    ['<base href="https://docs.example/guide/"><iframe srcdoc="<base href=mid/><iframe srcdoc=&quot;<a href=help>h</a>&quot;></iframe>"></iframe>', 'https://docs.example/guide/mid/help'],
    // A MathML element's href, which WebKit follows, is settled too.
    ['<math><mtext href="tlon://open">x</mtext></math>', '<mtext target="_blank">x</mtext>'],
    // An area inside an svg is an unknown element, which nothing follows.
    ['<svg><area href="tlon://open"><rect/></area></svg>', '<svg><area href="tlon://open"><rect/></area></svg>'],
    // Markup read as the tokenizer and tree builder read it.
    ['<p>İİİ</p><a href="tlon://open">open</a>', '<p>İİİ</p><a target="_blank">open</a>'],
    ['<p>İİİ</p><base href="https://b.example/"><a href="x">x</a>', '<a target="_blank" href="https://b.example/x">x</a>'],
    ['<a data=x=" href=/~/logout>open</a>', '<a target="_blank" data=x=">open</a>'],
    ['<svg><a href="https://example.com"/><text>Not a link</text></svg>', '<a target="_blank" href="https://example.com/"/><text>Not a link</text>'],
    ['<svg><title><a href="tlon://open" target="_blank">x</a></title></svg>', '<a target="_blank">x</a>'],
    ['<svg><style><a href="tlon://open" target="_blank">x</a></style></svg>', '<a target="_blank">x</a>'],
    ['<svg><textarea><a href="tlon://open" target="_blank">x</a></textarea></svg>', '<a target="_blank">x</a>'],
    ['<math><annotation-xml><textarea><a href="https://example.com">l</a></textarea>', '<a target="_blank" href="https://example.com/">l</a>'],
    ['<!--><a href="tlon://open" target="_blank">x</a>', '<a target="_blank">x</a>'],
    ['<!---><a href="tlon://open" target="_blank">x</a>', '<a target="_blank">x</a>'],
    ['<!-- x --!><a href="tlon://open" target="_blank">x</a>', '<a target="_blank">x</a>'],
    ['<? <!-- ><a href="tlon://open" target="_blank">x</a>', '<a target="_blank">x</a>'],
    ['<!x <!-- ><a href="tlon://open" target="_blank">x</a>', '<a target="_blank">x</a>'],
    ['</ <!-- ><a href="tlon://open" target="_blank">x</a>', '<a target="_blank">x</a>'],
    ['<svg><![CDATA[ <!-- ]]><a href="tlon://open" target="_blank">x</a>', '<a target="_blank">x</a>'],
    // Text that only looks like a link is left as it is, an integration
    // point's textarea included.
    [`<script>var s = '<a target="_self">';</script>`, `<script>var s = '<a target="_self">';</script>`],
    ['<!-- <a target="_self"> -->', '<!-- <a target="_self"> -->'],
    ['<textarea><a target="_self"></textarea>', '<textarea><a target="_self"></textarea>'],
    ['<svg><foreignObject><textarea><a href="x">l</a></textarea>', '<textarea><a href="x">l</a></textarea>'],
    ['<svg><desc><textarea><a href="x">l</a></textarea>', '<textarea><a href="x">l</a></textarea>'],
    ['<math><mi><textarea><a href="x">l</a></textarea>', '<textarea><a href="x">l</a></textarea>'],
    ['<math><annotation-xml encoding="text/html"><textarea><a href="x">l</a></textarea>', '<textarea><a href="x">l</a></textarea>'],
    ['<svg><p><textarea><a href="x">l</a></textarea>', '<textarea><a href="x">l</a></textarea>'],
    // An inline frame's document inherits its popups.
    [`<iframe srcdoc="<a href='zoommtg://join'>z</a><a href='https://w.example'>w</a>"></iframe>`, '<iframe srcdoc="&lt;a target=&quot;_blank&quot;&gt;z&lt;/a&gt;&lt;a target=&quot;_blank&quot; href=&quot;https://w.example/&quot;&gt;w&lt;/a&gt;"></iframe>'],
  ])('rewrites %j to hold %j', (file, expected) => {
    expect(scriptless(file)).toContain(expected);
  });

  it('carries no script of ours, and drops a srcdoc nested deeper than it reads', () => {
    const out = scriptless('<!doctype html><p>x</p>');
    expect(out).toContain(
      `content="${HTML_PREVIEW_POLICY}"><base target="_blank"><p>x</p>`
    );
    expect(out).not.toContain('<script');
    const deep = scriptless(nested('<a href="zoommtg://join">z</a>', 4));
    expect(deep).not.toContain('zoommtg');
    expect(deep.match(/<iframe/g)).toHaveLength(1);
  });
});

// Anyone who can upload writes these. The parser's time grows with the
// square of how deep a file nests, so a file nesting past the cap is declined
// at once, and one just under it still parses in bounded time. A file
// building more elements than the preview keeps is declined too.
describe('hostile markup', () => {
  it('is read in bounded time, and a file nesting too deep is declined', () => {
    const blank = `${' '.repeat(200_000)}<p>x</p>`;
    expect(htmlPreviewDocument(blank, KEY).endsWith(blank)).toBe(true);
    for (const html of [
      '<a'.repeat(200_000),
      '<!--'.repeat(200_000),
      '<a b="'.repeat(100_000),
      '<script>'.repeat(100_000),
      '<script><!--' + '<'.repeat(200_000),
    ]) {
      expect(htmlPreviewTitle(html)).toBeUndefined();
    }
    expect(scriptless('<a'.repeat(200_000))).toContain('<a<a');
    for (const html of [
      '<div>'.repeat(200_000),
      '<svg>'.repeat(100_000) + '</x>'.repeat(100_000),
      '<template>'.repeat(100_000) + '<script>go()</script>',
      '<svg>' + '<g>'.repeat(100_000) + '</svg><title>T</title>',
      '<title>T</title>' + '<br>'.repeat(200_000),
    ]) {
      expect(htmlPreviewReadable(html)).toBe(false);
      expect(htmlPreviewTitle(html)).toBeUndefined();
      expect(htmlPreviewHasScripts(html)).toBe(false);
    }
    // Just under the cap, each stray end tag rescans every open element.
    const nearCap = '<svg>'.repeat(120) + '</x>'.repeat(50_000);
    expect(htmlPreviewReadable(nearCap + '<title>T</title>')).toBe(true);
    expect(htmlPreviewReadable('<br>'.repeat(199_990))).toBe(true);
    expect(
      htmlPreviewTitle(nearCap + '</svg>'.repeat(120) + '<title>T</title>')
    ).toBe('T');
    expect(htmlPreviewHasScripts(nested('<p>static</p>', 400))).toBe(true);
  });

  // The browser parses an inline frame's document itself, as slowly. One the
  // frame's own sandbox keeps from scripts holds markup in its noscript.
  it('declines a file whose inline frame nests too deep', () => {
    const deep = '<div>'.repeat(1000);
    for (const html of [
      nested(deep, 1),
      nested(deep, 3),
      nested('<p>static</p>', 4),
      `<iframe sandbox="allow-popups" srcdoc="<noscript>${deep}</noscript>"></iframe>`,
    ]) {
      expect(htmlPreviewReadable(html)).toBe(false);
    }
    const noscript = `<iframe srcdoc="<noscript>${deep}</noscript>"></iframe>`;
    expect(htmlPreviewReadable(noscript)).toBe(true);
    expect(htmlPreviewReadable(noscript, { scripting: false })).toBe(false);
    expect(htmlPreviewReadable(nested('<p>static</p>', 3))).toBe(true);
    // Every frame a browser builds counts, at any depth.
    const frames = (count: number) => '<iframe></iframe>'.repeat(count);
    expect(htmlPreviewReadable(frames(100))).toBe(true);
    expect(htmlPreviewReadable(frames(101))).toBe(false);
    expect(htmlPreviewReadable(nested(frames(100), 1))).toBe(false);
    expect(htmlPreviewReadable(`<template>${frames(200)}</template>`)).toBe(
      true
    );
    expect(htmlPreviewReadable(`<template>${nested(deep, 1)}</template>`)).toBe(
      true
    );
  });
});

describe('htmlPreviewKey', () => {
  it('is 128 random bits of hex, fresh each time', () => {
    const first = htmlPreviewKey();
    expect(first).toMatch(/^[0-9a-f]{32}$/);
    expect(htmlPreviewKey()).not.toBe(first);
  });
});

describe('htmlPreviewLinkFromBridge', () => {
  const message = (fields: Record<string, unknown>) =>
    JSON.stringify({
      type: HTML_PREVIEW_LINK_MESSAGE,
      token: TOKEN,
      href: 'https://tlon.io/',
      ...fields,
    });

  it('reads a web, mail or phone link the shell sent with its token', () => {
    for (const href of [
      'https://tlon.io/',
      'http://example.com/shop?item=1',
      'mailto:hi@tlon.io',
      'tel:+15555550100',
    ]) {
      expect(htmlPreviewLinkFromBridge(message({ href }), TOKEN)).toBe(href);
    }
  });

  // Every frame can post to the bridge; only the shell knows the token.
  it.each([
    message({ token: 'guess' }),
    message({ token: undefined }),
    undefined,
    42,
    'not json',
    'null',
    '"https://tlon.io/"',
    message({ type: 'other' }),
    message({ href: 7 }),
    `${message({})}${' '.repeat(9000)}`,
    ...[
      'javascript:alert(1)',
      'data:text/html,<p>x</p>',
      'file:///etc/passwd',
      'sms:+15555550100',
      'tlon://open',
      'https://tlon.io/ evil',
      'https://tlon.io/\nevil',
      'https://tlon.io/\u0000',
    ].map((href) => message({ href })),
  ])('ignores %j', (data) => {
    expect(htmlPreviewLinkFromBridge(data, TOKEN)).toBeNull();
  });
});

describe('htmlPreviewNavigation', () => {
  // The two inline documents load. Anything else is the document leaving: a
  // link (the shell opens those over the bridge), a refresh, a form, a redirect.
  it('loads the inline documents and refuses the rest', () => {
    expect(htmlPreviewNavigation({ url: 'about:blank' })).toBe('load');
    expect(htmlPreviewNavigation({ url: 'about:srcdoc' })).toBe('load');
    for (const url of [
      'https://tlon.io/',
      'mailto:hi@tlon.io',
      'sms:+15555550100',
      'data:text/html,<p>x</p>',
      'javascript:alert(1)',
    ]) {
      expect(htmlPreviewNavigation({ url })).toBe('block');
    }
  });
});
