import { describe, expect, it } from 'vitest';

import {
  HTML_PREVIEW_LINK_MESSAGE,
  HTML_PREVIEW_NATIVE_SANDBOX,
  HTML_PREVIEW_POLICY,
  MAX_TEXT_PREVIEW_BYTES,
  bucketFileViewerHeading,
  canPreviewFromText,
  getBucketPreviewKind,
  htmlPreviewDocument,
  htmlPreviewKey,
  htmlPreviewLinkFromBridge,
  htmlPreviewNavigation,
  htmlPreviewSandboxes,
  htmlPreviewShell,
  htmlPreviewTitle,
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
  const streamOf = (...chunks: string[]) =>
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(new TextEncoder().encode(chunk));
        }
        controller.close();
      },
    });

  it('reads a body within the cap', async () => {
    const response = new Response(streamOf('<p>', 'héllo', '</p>'));
    expect(await readPreviewText(response, 64)).toBe('<p>héllo</p>');
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
      text: () => {
        touched = true;
        return Promise.resolve('');
      },
    } as unknown as Response;
    expect(await readPreviewText(response, 64)).toBeNull();
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
    expect(await readPreviewText(response, 64)).toBeNull();
    expect(cancelled).toBe(true);
    expect(sent).toBeLessThanOrEqual(4);
  });

  // React Native's fetch exposes no stream: the body is read whole, and a
  // result longer than the cap is refused after the fact.
  it('falls back to the whole text where the body does not stream', async () => {
    const unstreamed = (text: string) =>
      ({
        body: null,
        headers: new Headers(),
        text: () => Promise.resolve(text),
      }) as unknown as Response;
    expect(await readPreviewText(unstreamed('short'), 64)).toBe('short');
    expect(await readPreviewText(unstreamed('x'.repeat(65)), 64)).toBeNull();
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

  it('has none for a file without one, or with a blank one', () => {
    expect(htmlPreviewTitle('<p>hi</p>')).toBeUndefined();
    expect(htmlPreviewTitle('<title>  </title>')).toBeUndefined();
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
    for (const isElectron of [false, true]) {
      const sandboxes = htmlPreviewSandboxes({ isElectron });
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
    expect(htmlPreviewSandboxes({ isElectron: false })).toEqual({
      document: 'allow-scripts',
      shell: 'allow-scripts allow-popups allow-popups-to-escape-sandbox',
    });
  });

  // The desktop shell disables web security, which grants every document
  // universal access and so defeats the opaque origin. With no script in
  // either frame, only the reader's own click can follow a link.
  it('withholds scripts under Electron and lets links open as popups', () => {
    const popups = 'allow-popups allow-popups-to-escape-sandbox';
    expect(htmlPreviewSandboxes({ isElectron: true })).toEqual({
      document: popups,
      shell: popups,
    });
  });

  it('grants the native frame scripts and nothing else', () => {
    expect(HTML_PREVIEW_NATIVE_SANDBOX).toBe('allow-scripts');
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
  it('forbids connections, forms and objects, and frames anything but inline documents', () => {
    expect(HTML_PREVIEW_POLICY.split('; ').sort()).toEqual([
      "connect-src 'none'",
      "form-action 'none'",
      'frame-src about:',
      "object-src 'none'",
    ]);
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
      `<head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${HTML_PREVIEW_POLICY}">`
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
