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
  htmlPreviewKey,
  htmlPreviewLinkFromBridge,
  htmlPreviewNavigation,
  htmlPreviewSandboxes,
  htmlPreviewShell,
  htmlPreviewTitle,
  previewEncoding,
  readPreviewText,
} from './BucketFileViewer.shared';

describe('getBucketPreviewKind', () => {
  it.each([
    ['photo.jpg', 'image/jpeg', 'image'],
    ['demo.mp4', 'video/mp4', 'video'],
    ['notes.md', undefined, 'text'],
    ['index.html', 'text/html', 'html'],
    ['page.htm', undefined, 'html'],
    // The upload fallback mime, as a file sent without one arrives.
    ['export.html', 'application/octet-stream', 'html'],
    // A mime with parameters, as a bot upload can record it.
    ['index', 'text/html; charset=utf-8', 'html'],
    ['report.pdf', undefined, 'pdf'],
    ['archive.zip', 'application/zip', 'unsupported'],
  ] as const)('classifies %s as %s', (name, mimeType, expected) => {
    expect(getBucketPreviewKind({ name, mimeType })).toBe(expected);
  });
});

describe('canPreviewFromText', () => {
  // A text preview reads the whole object into memory, and the backend accepts
  // objects up to 5 GiB, so the size is the gate rather than the type.
  it('refuses a text file past the cap', () => {
    const item = { name: 'export.csv', mimeType: 'text/csv' };
    expect(canPreviewFromText({ ...item, size: MAX_TEXT_PREVIEW_BYTES })).toBe(
      true
    );
    expect(
      canPreviewFromText({ ...item, size: MAX_TEXT_PREVIEW_BYTES + 1 })
    ).toBe(false);
  });

  // Extension alone makes something text, so a renamed dump reaches this path.
  it('gates on size even when only the extension says text', () => {
    expect(
      canPreviewFromText({ name: 'dump.txt', size: 4 * 1024 * 1024 * 1024 })
    ).toBe(false);
  });

  it('still refuses anything that is not text', () => {
    expect(
      canPreviewFromText({ name: 'clip.mp4', mimeType: 'video/mp4' })
    ).toBe(false);
  });

  // An entry with no size recorded is allowed through rather than blocked.
  it('allows a text file whose size is unknown', () => {
    expect(canPreviewFromText({ name: 'notes.md' })).toBe(true);
  });

  // An HTML file is rendered from the same fetched string, so it is gated
  // the same way.
  it('gates an html file on the same cap', () => {
    const item = { name: 'report.html', mimeType: 'text/html' };
    expect(canPreviewFromText({ ...item, size: MAX_TEXT_PREVIEW_BYTES })).toBe(
      true
    );
    expect(
      canPreviewFromText({ ...item, size: MAX_TEXT_PREVIEW_BYTES + 1 })
    ).toBe(false);
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

  it('reads a body within the cap', async () => {
    const response = new Response(streamOf('<p>', 'héllo', '</p>'));
    expect(await readPreviewText(response, { limit: 64 })).toBe('<p>héllo</p>');
  });

  // The manifest size is the writer's word, so the response's own length is
  // checked before a byte is read.
  it('refuses a body whose declared length is over the cap', async () => {
    let touched = false;
    const response = {
      headers: new Headers({ 'content-length': '65' }),
      get body() {
        touched = true;
        return null;
      },
      arrayBuffer: () => {
        touched = true;
        return Promise.resolve(new ArrayBuffer(0));
      },
    } as unknown as Response;
    expect(await readPreviewText(response, { limit: 64 })).toBeNull();
    expect(touched).toBe(false);
  });

  // Without a length, the read stops at the first byte past the cap rather
  // than finishing the download.
  it('stops reading an undeclared body at the cap', async () => {
    let cancelled = false;
    const chunk = new Uint8Array(32);
    let sent = 0;
    const response = new Response(
      new ReadableStream<Uint8Array>({
        pull(controller) {
          sent += 1;
          controller.enqueue(chunk);
        },
        cancel() {
          cancelled = true;
        },
      })
    );
    expect(await readPreviewText(response, { limit: 64 })).toBeNull();
    expect(cancelled).toBe(true);
    expect(sent).toBeLessThanOrEqual(4);
  });

  // `café` in windows-1252: the é is the single byte 0xE9, which UTF-8
  // decoding turns into a replacement character.
  const cafe = new Uint8Array([0x63, 0x61, 0x66, 0xe9]);

  it('decodes in the charset the response declares', async () => {
    const response = new Response(streamOf(cafe), {
      headers: { 'content-type': 'text/plain; charset=windows-1252' },
    });
    expect(await readPreviewText(response)).toBe('café');
  });

  it('decodes an HTML page in its own <meta> charset', async () => {
    const page = (html: boolean) =>
      readPreviewText(
        new Response(
          streamOf('<!doctype html><meta charset="windows-1252"><p>', cafe),
          { headers: { 'content-type': 'text/html' } }
        ),
        { html }
      );
    expect(await page(true)).toBe(
      '<!doctype html><meta charset="windows-1252"><p>café'
    );
    // A text file's contents are not a declaration.
    expect(await page(false)).toContain('caf�');
  });

  // Expo's TextDecoder, which React Native apps get, knows only UTF-8 and
  // throws for any other label.
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

  describe('where the runtime decodes only UTF-8', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('still decodes windows-1252 and what a browser reads as it', async () => {
      vi.stubGlobal('TextDecoder', Utf8OnlyDecoder);
      const euro = new Uint8Array([0x80, 0x20, 0x93, 0x71, 0x94]);
      for (const charset of ['windows-1252', 'iso-8859-1', 'latin1']) {
        const response = new Response(
          streamOf(cafe, new Uint8Array([0x20]), euro),
          {
            headers: { 'content-type': `text/plain; charset=${charset}` },
          }
        );
        expect(await readPreviewText(response)).toBe('café € “q”');
      }
    });

    it('still decodes UTF-16 from its byte order mark, either way round', async () => {
      vi.stubGlobal('TextDecoder', Utf8OnlyDecoder);
      const text = '<p>café ✓</p>';
      const units = [...text].map((char) => char.charCodeAt(0));
      const le = new Uint8Array([
        0xff,
        0xfe,
        ...units.flatMap((u) => [u & 0xff, u >> 8]),
      ]);
      const be = new Uint8Array([
        0xfe,
        0xff,
        ...units.flatMap((u) => [u >> 8, u & 0xff]),
      ]);
      for (const bytes of [le, be]) {
        expect(
          await readPreviewText(new Response(streamOf(bytes)), { html: true })
        ).toBe(text);
      }
    });

    // Anything else it cannot decode is read as UTF-8, as before.
    it('reads an encoding it does not know as UTF-8', async () => {
      vi.stubGlobal('TextDecoder', Utf8OnlyDecoder);
      const response = new Response(streamOf('plain ascii'), {
        headers: { 'content-type': 'text/plain; charset=shift_jis' },
      });
      expect(await readPreviewText(response)).toBe('plain ascii');
    });
  });

  // Nothing can stop a body that does not stream at the cap, and a compressed
  // one can grow past any declared length, so it is declined unread.
  it('declines a body that does not stream', async () => {
    let read = false;
    const unstreamed = {
      arrayBuffer: () => {
        read = true;
        return Promise.resolve(new ArrayBuffer(0));
      },
      body: null,
      headers: new Headers({ 'content-length': '5' }),
    } as unknown as Response;
    expect(await readPreviewText(unstreamed, { limit: 64 })).toBeNull();
    expect(read).toBe(false);
  });
});

describe('previewEncoding', () => {
  const page = (head: string, contentType?: string, html = true) =>
    previewEncoding({ contentType, head, html });

  it('lets a byte order mark decide first', () => {
    expect(
      page('ï»¿<meta charset="windows-1252">', 'text/html; charset=shift_jis')
    ).toBe('utf-8');
    expect(page('ÿþ<\u0000')).toBe('utf-16le');
    expect(page('þÿ\u0000<')).toBe('utf-16be');
  });

  it('takes the charset the response declares next', () => {
    expect(
      page('<meta charset="windows-1252">', 'text/html; charset="Shift_JIS"')
    ).toBe('shift_jis');
  });

  it("reads an HTML page's own declaration, in either form", () => {
    expect(page('<!doctype html><meta charset=windows-1252>')).toBe(
      'windows-1252'
    );
    expect(
      page(
        '<meta http-equiv="Content-Type" content="text/html; charset=ISO-8859-1">'
      )
    ).toBe('iso-8859-1');
  });

  // Only a real declaration counts: charset= in a comment, or in a meta that
  // is not about the encoding, says nothing about it.
  it('reads only a genuine declaration', () => {
    expect(page('<!-- charset=windows-1252 --><p>x</p>')).toBe('utf-8');
    expect(
      page('<meta name="description" content="charset=windows-1252">')
    ).toBe('utf-8');
    expect(
      page('<meta http-equiv="refresh" content="0; charset=windows-1252">')
    ).toBe('utf-8');
    expect(
      page(
        '<meta content="text/html; charset=windows-1252" http-equiv="Content-Type">'
      )
    ).toBe('windows-1252');
    expect(page('<meta charset = " windows-1252 ">')).toBe('windows-1252');
    expect(
      page('<!-- <meta charset="shift_jis"> --><meta charset="windows-1252">')
    ).toBe('windows-1252');
  });

  // An ASCII <meta> cannot be read from a document that really is UTF-16.
  it('reads a UTF-16 declaration as UTF-8', () => {
    expect(page('<meta charset="utf-16">')).toBe('utf-8');
  });

  it('defaults to UTF-8, and ignores a declaration past the first 1024 bytes or in plain text', () => {
    expect(page('<p>no declaration</p>')).toBe('utf-8');
    expect(page(`${' '.repeat(1024)}<meta charset="windows-1252">`)).toBe(
      'utf-8'
    );
    expect(page('<meta charset="windows-1252">', undefined, false)).toBe(
      'utf-8'
    );
  });
});

describe('htmlPreviewTitle', () => {
  it('reads the title as the page would show it', () => {
    expect(
      htmlPreviewTitle(
        '<!doctype html><html><head><title>\n  Launch &amp; recap &#x2014; Q3  </title></head><body></body></html>'
      )
    ).toBe('Launch & recap — Q3');
  });

  it('ignores a title inside an svg, and one in a comment', () => {
    expect(
      htmlPreviewTitle(
        '<!-- <title>draft</title> --><svg><title>icon</title></svg><title>Report</title>'
      )
    ).toBe('Report');
  });

  // The parser reads none of these as a title element.
  it('ignores a title in a script, a style, a template, a textarea or an attribute', () => {
    expect(
      htmlPreviewTitle(
        `<script>const sample = '<title>Draft</title>';</script>` +
          '<style>/* <title>Style</title> */</style>' +
          '<template><title>Inert</title></template>' +
          '<textarea><title>Typed</title></textarea>' +
          '<div data-x="a>b<title>Attr</title>"></div>' +
          '<TITLE>Final</TITLE>'
      )
    ).toBe('Final');
  });

  it('decodes references as a browser does', () => {
    expect(htmlPreviewTitle('<title>Report &copy; 2026</title>')).toBe(
      'Report © 2026'
    );
    // HTML5's references, not only HTML 4's.
    expect(htmlPreviewTitle('<title>Status &check; &bigstar;</title>')).toBe(
      'Status ✓ ★'
    );
    // Legacy names need no semicolon, and match their longest prefix.
    expect(htmlPreviewTitle('<title>&copy 2026 &notit;</title>')).toBe(
      '© 2026 ¬it;'
    );
    expect(
      htmlPreviewTitle(
        '<title>&Alpha;&hearts;&euro;&hellip;&lang;&AMP;</title>'
      )
    ).toBe('Α♥€…⟨&');
    // A numeric reference into C1 is the windows-1252 character; zero, a
    // surrogate or past Unicode is the replacement character.
    expect(
      htmlPreviewTitle('<title>a&#150;b&#x0;&#xD800;&#1114112;</title>')
    ).toBe('a–b���');
    expect(htmlPreviewTitle('<title>&bogus; &amp</title>')).toBe('&bogus; &');
  });

  // document.title strips and collapses ASCII whitespace only.
  it('keeps a no-break space', () => {
    expect(htmlPreviewTitle('<title>\n A&nbsp;&nbsp;B \t</title>')).toBe(
      'A  B'
    );
  });

  // Template content is inert at any depth, and an svg title is the
  // drawing's, nested or not.
  it('reads past nested templates and svgs', () => {
    expect(
      htmlPreviewTitle(
        '<template><template></template><title>Draft</title></template><title>Final</title>'
      )
    ).toBe('Final');
    expect(
      htmlPreviewTitle(
        '<svg><svg></svg><title>Icon</title></svg><svg/><title>Final</title>'
      )
    ).toBe('Final');
  });

  it('has none for a file without one, a blank one, or one never closed', () => {
    expect(htmlPreviewTitle('<p>hi</p>')).toBeUndefined();
    expect(htmlPreviewTitle('<title>  </title>')).toBeUndefined();
    expect(htmlPreviewTitle('<title>Unclosed')).toBeUndefined();
    expect(htmlPreviewTitle('<plaintext><title>Text</title>')).toBeUndefined();
  });
});

describe('bucketFileViewerHeading', () => {
  const file = {
    name: 'report.html',
    mimeType: 'text/html',
    sizeLabel: '4 KB',
  };

  it('names a rendered page by its title, with the file beneath', () => {
    expect(
      bucketFileViewerHeading({
        ...file,
        textContent: '<title>Quarterly numbers</title>',
      })
    ).toEqual({ subtitle: 'report.html · 4 KB', title: 'Quarterly numbers' });
  });

  it('names a file by its name otherwise', () => {
    expect(bucketFileViewerHeading(file)).toEqual({
      subtitle: '4 KB',
      title: 'report.html',
    });
    expect(
      bucketFileViewerHeading({ ...file, textContent: '<p>untitled</p>' })
    ).toEqual({ subtitle: '4 KB', title: 'report.html' });
    expect(
      bucketFileViewerHeading({
        name: 'notes.md',
        textContent: '<title>not a page</title>',
      })
    ).toEqual({ subtitle: 'File', title: 'notes.md' });
  });
});

describe('htmlPreviewSandboxes', () => {
  // An unsandboxed srcdoc document inherits the app's origin, and
  // allow-same-origin would hand it back. Forms would post with the reader's
  // cookie in some browsers; modals would be the app's own dialogs; top
  // navigation would take the app's own tab. None may happen in either frame.
  it('never grants either frame the app origin, forms, dialogs or the top', () => {
    for (const scripts of [true, false]) {
      const sandboxes = htmlPreviewSandboxes({ scripts });
      for (const tokens of [sandboxes.document, sandboxes.shell]) {
        for (const forbidden of [
          'allow-same-origin',
          'allow-forms',
          'allow-modals',
          'allow-top-navigation',
        ]) {
          expect(tokens.split(' ')).not.toContain(forbidden);
        }
      }
    }
  });

  // The file's frame cannot open a window, which it could otherwise do with
  // no tap at all; the shell opens its links for it.
  it('runs the file in a browser with scripts and nothing else', () => {
    expect(htmlPreviewSandboxes({ scripts: true })).toEqual({
      document: 'allow-scripts',
      shell: 'allow-scripts allow-popups allow-popups-to-escape-sandbox',
    });
  });

  // The desktop shell disables web security, which grants every document
  // universal access and so defeats the opaque origin. With no script in
  // either frame, only the reader's own click can follow a link.
  it('withholds scripts under Electron and lets links open as popups', () => {
    const popups = 'allow-popups allow-popups-to-escape-sandbox';
    expect(htmlPreviewSandboxes({ scripts: false })).toEqual({
      document: popups,
      shell: popups,
    });
  });

  it('grants the native frame scripts and nothing else', () => {
    expect(HTML_PREVIEW_NATIVE_SANDBOX).toBe('allow-scripts');
  });
});

// `html` as the document of an inline frame, `levels` frames deep.
function nested(html: string, levels: number): string {
  let doc = html;
  for (let level = 0; level < levels; level += 1) {
    doc = `<iframe srcdoc="${doc.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"></iframe>`;
  }
  return doc;
}

describe('htmlPreviewHasScripts', () => {
  it('finds a script element, a handler attribute or a javascript: URL', () => {
    for (const html of [
      '<script>go()</script>',
      '<SCRIPT src="x.js"></SCRIPT>',
      '<button onclick="go()">go</button>',
      '<svg onload = "go()"></svg>',
      '<a href="javascript:go()">go</a>',
    ]) {
      expect(htmlPreviewHasScripts(html), html).toBe(true);
    }
  });

  // As the browser reads the attribute: references decoded, tabs dropped.
  it('finds a javascript: URL however it is spelled', () => {
    for (const html of [
      '<a href="java&#x73;cript:go()">go</a>',
      '<a href="java\tscript:go()">go</a>',
      '<a href=" JAVASCRIPT:go()">go</a>',
      '<iframe srcdoc="&lt;script&gt;go()&lt;/script&gt;"></iframe>',
    ]) {
      expect(htmlPreviewHasScripts(html), html).toBe(true);
    }
  });

  it('finds nothing in a static page', () => {
    expect(
      htmlPreviewHasScripts(
        '<p>A page about online scripts.</p><a href="x">x</a>'
      )
    ).toBe(false);
    // Only in an attribute a browser follows is it a script.
    expect(
      htmlPreviewHasScripts('<abbr title="javascript: a language">JS</abbr>')
    ).toBe(false);
    expect(
      htmlPreviewHasScripts('<style>a::after { content: "<script>"; }</style>')
    ).toBe(false);
    expect(htmlPreviewHasScripts(nested('<p>static</p>', 3))).toBe(false);
  });

  // Each nested document is read again, so a file of them could take a scan
  // per level; past the depth read, a frame is taken to have scripts.
  it('takes a document nested deeper than it reads as having scripts', () => {
    expect(htmlPreviewHasScripts(nested('<p>static</p>', 4))).toBe(true);
    expect(htmlPreviewHasScripts(nested('<p>static</p>', 400))).toBe(true);
  });
});

describe('htmlPreviewKey', () => {
  it('is 128 random bits of hex, fresh each time', () => {
    const first = htmlPreviewKey();
    expect(first).toMatch(/^[0-9a-f]{32}$/);
    expect(htmlPreviewKey()).not.toBe(first);
  });
});

describe('HTML_PREVIEW_POLICY', () => {
  const directives = new Map(
    HTML_PREVIEW_POLICY.split('; ').map((directive) => {
      const [name, ...sources] = directive.split(' ');
      return [name, sources] as const;
    })
  );

  it('forbids connections, forms and objects, and frames anything but inline documents', () => {
    expect(directives.get('connect-src')).toEqual(["'none'"]);
    expect(directives.get('form-action')).toEqual(["'none'"]);
    expect(directives.get('object-src')).toEqual(["'none'"]);
    expect(directives.get('frame-src')).toEqual(['about:']);
  });

  // The reader's ship would answer a request as the reader (`/~/logout` is a
  // GET), and a source list cannot exclude one host, so it names only what
  // can never be a ship: nothing by default, inline and data: or blob:
  // resources, and public CDNs.
  it('lets nothing load from anywhere a ship, or a page author, could be', () => {
    expect(directives.get('default-src')).toEqual(["'none'"]);
    const allowedHosts = new Set([
      'https://cdnjs.cloudflare.com',
      'https://cdn.jsdelivr.net',
      'https://unpkg.com',
      'https://cdn.tailwindcss.com',
      'https://code.jquery.com',
      'https://fonts.googleapis.com',
      'https://fonts.gstatic.com',
    ]);
    for (const [name, sources] of directives) {
      for (const source of sources) {
        const allowed =
          ["'none'", "'unsafe-inline'", "'unsafe-eval'"].includes(source) ||
          ['data:', 'blob:', 'about:'].includes(source) ||
          allowedHosts.has(source);
        expect(allowed, `${name} ${source}`).toBe(true);
      }
    }
    expect(HTML_PREVIEW_POLICY).not.toContain("'self'");
    expect(HTML_PREVIEW_POLICY).not.toMatch(/(^|\s)(https?:|\*)(\s|;|$)/);
  });
});

const KEY = '0123456789abcdef0123456789abcdef';
const TOKEN = 'fedcba9876543210fedcba9876543210';

describe('htmlPreviewShell', () => {
  const file = '<!doctype html><p class="x">a & b</p><script>alert(1)</script>';
  const webShell = htmlPreviewShell({
    document: file,
    key: KEY,
    opener: { kind: 'window' },
    sandbox: 'allow-scripts',
  });
  const nativeShell = htmlPreviewShell({
    document: file,
    key: KEY,
    opener: { kind: 'app', token: TOKEN },
    sandbox: 'allow-scripts',
  });

  // The document inside inherits the shell's policy, so this is the copy the
  // file's own markup cannot reach; its frame-src is also what refuses the
  // frame's own navigation, which only a parent can.
  it('carries the policy in its head', () => {
    expect(webShell).toContain(
      `<meta http-equiv="Content-Security-Policy" content="${HTML_PREVIEW_POLICY}">`
    );
    expect(webShell.indexOf('Content-Security-Policy')).toBeLessThan(
      webShell.indexOf('</head>')
    );
  });

  // On native the shell is the WebView's page: without a viewport of its own
  // iOS lays the file out at desktop width and shrinks it to fit.
  it('lays the page out at the device width', () => {
    expect(nativeShell).toContain(
      '<meta name="viewport" content="width=device-width, initial-scale=1">'
    );
  });

  it('holds the file in a sandboxed frame, escaped', () => {
    expect(webShell).toContain('<iframe sandbox="allow-scripts" srcdoc="');
    expect(webShell).toContain(
      '&lt;p class=&quot;x&quot;&gt;a &amp; b&lt;/p&gt;&lt;script&gt;alert(1)&lt;/script&gt;'
    );
  });

  // The one unescaped script is ours: the file's is inside the attribute.
  it('runs one script of its own, after the frame', () => {
    expect(webShell.match(/<script/g)).toHaveLength(1);
    expect(webShell.indexOf('<script')).toBeGreaterThan(
      webShell.indexOf('</iframe>')
    );
  });

  // A link opens only from the file's frame, with the key, while the browser
  // holds a tap on record, and only as a web, mail or phone link.
  it('opens a link only when every check passes', () => {
    for (const check of [
      'event.source !== frame.contentWindow',
      `data.type !== '${HTML_PREVIEW_LINK_MESSAGE}'`,
      'data.key !== key',
      'navigator.userActivation',
      '!activation.isActive',
      '/^(https?|mailto|tel):$/.test(url.protocol)',
    ]) {
      expect(webShell).toContain(check);
    }
    expect(webShell).toContain(`})('${KEY}', function (href)`);
  });

  it('opens a new tab on web', () => {
    expect(webShell).toContain(
      "window.open(href, '_blank', 'noopener,noreferrer')"
    );
    expect(webShell).not.toContain('ReactNativeWebView');
  });

  // On native the app opens it, and checks the token first.
  it('asks the app on native, with the token', () => {
    expect(nativeShell).toContain('window.ReactNativeWebView.postMessage(');
    expect(nativeShell).toContain(`token: '${TOKEN}'`);
    expect(nativeShell).not.toContain('window.open(');
  });
});

describe('htmlPreviewDocument', () => {
  const lead = `${`<meta http-equiv="Content-Security-Policy" content="${HTML_PREVIEW_POLICY}">`}<base target="_blank"><script>`;

  function expectInserted(out: string, before: string, after: string) {
    expect(out.startsWith(before + lead)).toBe(true);
    expect(out.endsWith(`</script>${after}`)).toBe(true);
  }

  it('places the policy, a new-tab target and our link script after the doctype', () => {
    expectInserted(
      htmlPreviewDocument('<!doctype html><p>x</p>', KEY),
      '<!doctype html>',
      '<p>x</p>'
    );
  });

  // The script is the one that hands a tapped link to the shell: it carries
  // the key in its closure and removes its own element before the file's
  // first script can read it.
  it('gives our script the key and lets it remove itself', () => {
    const out = htmlPreviewDocument('<!doctype html><p>x</p>', KEY);
    expect(out).toContain(`})('${KEY}');`);
    expect(out).toContain('document.currentScript');
    expect(out).toContain('self.remove()');
    // Only a click the reader made is handed on.
    expect(out).toContain('event.isTrusted');
    // A page that cancels its own link click keeps it cancelled.
    expect(out).toContain('if (event.defaultPrevented) return;');
  });

  it('keeps the rest of the document as it was', () => {
    const out = htmlPreviewDocument(
      '<!DOCTYPE html>\n<html><head><title>t</title></head><body>b</body></html>',
      KEY
    );
    expectInserted(
      out,
      '<!DOCTYPE html>',
      '\n<html><head><title>t</title></head><body>b</body></html>'
    );
  });

  it('places it all first when there is no doctype', () => {
    expectInserted(htmlPreviewDocument('<p>hi</p>', KEY), '', '<p>hi</p>');
  });

  it('tolerates a byte order mark and whitespace before the doctype', () => {
    expectInserted(
      htmlPreviewDocument('﻿  <!doctype html><p>x</p>', KEY),
      '﻿  <!doctype html>',
      '<p>x</p>'
    );
  });

  // A comment or an XML declaration may precede the doctype. The fragment
  // still has to land after the doctype, or the parser drops the doctype and
  // the page goes quirks.
  it('keeps a doctype that follows a comment or an xml declaration', () => {
    expectInserted(
      htmlPreviewDocument('<!-- generated -->\n<!DOCTYPE html>\n<p>x</p>', KEY),
      '<!-- generated -->\n<!DOCTYPE html>',
      '\n<p>x</p>'
    );
    expectInserted(
      htmlPreviewDocument(
        '<?xml version="1.0"?>\n<!DOCTYPE html>\n<p>x</p>',
        KEY
      ),
      '<?xml version="1.0"?>\n<!DOCTYPE html>',
      '\n<p>x</p>'
    );
  });

  // A `>` ends a DOCTYPE token in every tokenizer state, inside a quoted
  // identifier included, so the fragment follows the parser's doctype, not
  // the quote's.
  it('ends the doctype where the parser does', () => {
    expectInserted(
      htmlPreviewDocument('<!DOCTYPE html SYSTEM "a>b"><p>x</p>', KEY),
      '<!DOCTYPE html SYSTEM "a>',
      'b"><p>x</p>'
    );
  });
});

// Under Electron no script runs in the frame, so links are aimed at `_blank`
// in the markup itself: one aimed at the frame would be refused, and an SVG
// link ignores the <base> target.
describe('htmlPreviewDocument without scripts', () => {
  const scriptless = (html: string) =>
    htmlPreviewDocument(html, KEY, { scripts: false });

  it('aims every web, mail and phone link at _blank, whatever it was aimed at', () => {
    const out = scriptless(
      '<a href="https://a.example" target="_self">a</a>' +
        '<A HREF=https://b.example TARGET=_top>b</A>' +
        '<map><area href="mailto:c@example.com" target=\'_parent\'></map>' +
        '<a href="tel:+15555550100">d</a>' +
        '<svg><a xlink:href="https://e.example"><text>e</text></a></svg>'
    );
    expect(out).toContain('<a target="_blank" href="https://a.example/">a</a>');
    expect(out).toContain('<A target="_blank" href="https://b.example/">b</A>');
    expect(out).toContain('<area target="_blank" href="mailto:c@example.com">');
    expect(out).toContain('<a target="_blank" href="tel:+15555550100">d</a>');
    expect(out).toContain('<a target="_blank" href="https://e.example/">');
  });

  // With no script to check where it goes, a popup escaping the sandbox
  // could open an unsandboxed document or hand an address to another app.
  it('takes the address from a link to any other scheme', () => {
    const out = scriptless(
      '<a href="data:text/html,<b>x</b>" class="d">d</a>' +
        '<a href="java&#x73;cript:go()" class="j">j</a>' +
        '<a href=" FILE:///etc/passwd" class="f">f</a>' +
        '<a href="zoommtg://join" class="z">z</a>'
    );
    for (const name of ['d', 'j', 'f', 'z']) {
      expect(out).toContain(`<a target="_blank" class="${name}">${name}</a>`);
    }
    expect(out).not.toMatch(/href=/i);
  });

  // A fragment stays in the file, scrolling there without a script.
  it('keeps a fragment in the file', () => {
    const out = scriptless('<a href="#bottom">b</a><a href="">top</a>');
    expect(out).toContain('<a target="_self" href="about:srcdoc#bottom">b</a>');
    expect(out).toContain('<a target="_self" href="about:srcdoc#">top</a>');
  });

  // A Bucket file has no address of its own its neighbours could be reached
  // from; a base the file sets itself gives relative links one.
  it('keeps a relative link only against an http(s) base the file sets', () => {
    expect(scriptless('<a href="help.html">h</a>')).toContain(
      '<a target="_blank">h</a>'
    );
    // A scheme-relative link takes https, as with scripts running.
    expect(scriptless('<a href="//cdn.example/x">x</a>')).toContain(
      '<a target="_blank" href="https://cdn.example/x">x</a>'
    );
    const based = scriptless(
      '<base href="https://docs.example/guide/"><a href="help.html">h</a><a href="#s">s</a><a href="//cdn.example/x">x</a>'
    );
    expect(based).toContain(
      '<a target="_blank" href="https://docs.example/guide/help.html">h</a>'
    );
    expect(based).toContain(
      '<a target="_blank" href="https://docs.example/guide/#s">s</a>'
    );
    expect(based).toContain(
      '<a target="_blank" href="https://cdn.example/x">x</a>'
    );
    expect(
      scriptless('<base href="data:text/html,x"><a href="help.html">h</a>')
    ).toContain('<a target="_blank">h</a>');
    // A scheme-relative base takes https, as a link does.
    expect(
      scriptless('<base href="//docs.example/guide/"><a href="help.html">h</a>')
    ).toContain(
      '<a target="_blank" href="https://docs.example/guide/help.html">h</a>'
    );
  });

  // Left to the browser, a relative address resolves against the app's own,
  // the reader's ship, so every address kept is computed here.
  it('computes each address itself, never leaving one to resolve against the app', () => {
    // With a base of the same scheme, a special scheme without slashes is
    // relative.
    expect(scriptless('<a href="https:/~/logout">x</a>')).toContain(
      '<a target="_blank" href="https://~/logout">x</a>'
    );
    // A base the browser cannot use, or a relative one, is no base.
    for (const base of ['http:', 'https://exa mple.com/', '/docs/']) {
      expect(
        scriptless(`<base href="${base}"><a href="/~/logout">x</a>`),
        base
      ).toContain('<a target="_blank">x</a>');
    }
    // A base in a template, an svg or math sets nothing; one after them does.
    for (const inert of [
      '<template><base href="https://t.example/"></template>',
      '<svg><base href="https://t.example/"/></svg>',
      '<math><base href="https://t.example/"></base></math>',
    ]) {
      expect(scriptless(`${inert}<a href="help.html">x</a>`), inert).toContain(
        '<a target="_blank">x</a>'
      );
    }
    expect(
      scriptless(
        '<svg/><template></template><base href="https://t.example/"><a href="help.html">x</a>'
      )
    ).toContain('<a target="_blank" href="https://t.example/help.html">x</a>');
  });

  // A document in an inline frame inherits the frame's popups.
  it('settles the links in an inline frame, as deep as it reads', () => {
    expect(
      scriptless(
        `<iframe srcdoc="<a href='zoommtg://join'>z</a><a href='https://w.example'>w</a>"></iframe>`
      )
    ).toContain(
      '<iframe srcdoc="&lt;a target=&quot;_blank&quot;&gt;z&lt;/a&gt;&lt;a target=&quot;_blank&quot; href=&quot;https://w.example/&quot;&gt;w&lt;/a&gt;"></iframe>'
    );
    const deep = scriptless(nested('<a href="zoommtg://join">z</a>', 4));
    expect(deep).not.toContain('zoommtg');
    expect(deep.match(/<iframe/g)).toHaveLength(1);
  });

  it('leaves text that only looks like a link alone', () => {
    const out = scriptless(
      `<script>var s = '<a target="_self">';</script>` +
        '<!-- <a target="_self"> -->' +
        '<textarea><a target="_self"></textarea>' +
        '<a title="target=_self" href="https://x.example">x</a>'
    );
    expect(out).toContain(`<script>var s = '<a target="_self">';</script>`);
    expect(out).toContain('<!-- <a target="_self"> -->');
    expect(out).toContain('<textarea><a target="_self"></textarea>');
    expect(out).toContain(
      '<a target="_blank" href="https://x.example/" title="target=_self">'
    );
  });

  // Our link script would be inert; the policy and the base target stay.
  it('leaves out our link script', () => {
    const out = scriptless('<!doctype html><p>x</p>');
    expect(out).not.toContain('<script>');
    expect(out).toContain(
      `content="${HTML_PREVIEW_POLICY}"><base target="_blank"><p>x</p>`
    );
  });

  it('rewrites a file of unclosed tags at once', () => {
    expect(scriptless('<a'.repeat(200_000))).toContain('<a<a');
  });
});

// Our scripts are written into the documents as text; a slip in an escape
// would break every preview silently.
describe('the scripts the documents carry', () => {
  it('parse', () => {
    const doc = htmlPreviewDocument('<p>x</p>', KEY);
    const linkScript = doc.slice(
      doc.indexOf('<script>') + 8,
      doc.indexOf('</script>')
    );
    expect(() => new Function(linkScript)).not.toThrow();
    for (const opener of [
      { kind: 'window' },
      { kind: 'app', token: TOKEN },
    ] as const) {
      const shell = htmlPreviewShell({
        document: '',
        key: KEY,
        opener,
        sandbox: 'allow-scripts',
      });
      const shellScript = shell.slice(
        shell.lastIndexOf('<script>') + 8,
        shell.lastIndexOf('</script>')
      );
      expect(() => new Function(shellScript)).not.toThrow();
    }
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

  it('reads a link the shell sent with the token', () => {
    expect(htmlPreviewLinkFromBridge(message({}), TOKEN)).toBe(
      'https://tlon.io/'
    );
    for (const href of [
      'http://example.com/shop?item=1',
      'mailto:hi@tlon.io',
      'tel:+15555550100',
    ]) {
      expect(htmlPreviewLinkFromBridge(message({ href }), TOKEN)).toBe(href);
    }
  });

  // Every frame can post to the bridge, the file's included; only the shell
  // knows the token.
  it('ignores a message without the token', () => {
    expect(
      htmlPreviewLinkFromBridge(message({ token: 'guess' }), TOKEN)
    ).toBeNull();
    expect(
      htmlPreviewLinkFromBridge(message({ token: undefined }), TOKEN)
    ).toBeNull();
  });

  it('ignores anything that is not a link message', () => {
    for (const data of [
      undefined,
      42,
      'not json',
      'null',
      '"https://tlon.io/"',
      message({ type: 'other' }),
      message({ href: 7 }),
      `${message({})}${' '.repeat(9000)}`,
    ]) {
      expect(htmlPreviewLinkFromBridge(data, TOKEN)).toBeNull();
    }
  });

  it('opens only a web, mail or phone link, in one piece', () => {
    for (const href of [
      'javascript:alert(1)',
      'data:text/html,<p>x</p>',
      'file:///etc/passwd',
      'sms:+15555550100',
      'tlon://open',
      'https://tlon.io/ evil',
      'https://tlon.io/\nevil',
      'https://tlon.io/\u0000',
    ]) {
      expect(htmlPreviewLinkFromBridge(message({ href }), TOKEN)).toBeNull();
    }
  });
});

// Anyone who can upload writes these; a scan that backtracks would hang the
// app's thread before the sandbox was even rendered.
describe('hostile markup', () => {
  it('places the fragment in a file of whitespace with no doctype, at once', () => {
    const file = `${' '.repeat(200_000)}<p>x</p>`;
    expect(htmlPreviewDocument(file, KEY).endsWith(file)).toBe(true);
  });

  it('finds no title in a file of unclosed tags, comments or quotes, at once', () => {
    expect(htmlPreviewTitle('<a'.repeat(200_000))).toBeUndefined();
    expect(htmlPreviewTitle('<!--'.repeat(200_000))).toBeUndefined();
    expect(htmlPreviewTitle('<a b="'.repeat(100_000))).toBeUndefined();
    expect(htmlPreviewTitle('<script>'.repeat(100_000))).toBeUndefined();
  });
});

describe('htmlPreviewNavigation', () => {
  // The shell and the frame inside it both load as inline documents.
  it('loads the inline documents', () => {
    expect(htmlPreviewNavigation({ url: 'about:blank' })).toBe('load');
    expect(htmlPreviewNavigation({ url: 'about:srcdoc' })).toBe('load');
  });

  // A link (the shell opens those over the bridge instead), a meta refresh, a
  // form, a redirect, another scheme: the document leaving, which it may not.
  it('refuses everything else', () => {
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
