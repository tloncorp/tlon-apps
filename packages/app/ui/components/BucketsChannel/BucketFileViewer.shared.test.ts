import { describe, expect, it } from 'vitest';

import {
  HTML_PREVIEW_NATIVE_SANDBOX,
  HTML_PREVIEW_POLICY,
  MAX_TEXT_PREVIEW_BYTES,
  bucketFileViewerHeading,
  canPreviewFromText,
  getBucketPreviewKind,
  htmlPreviewDocument,
  htmlPreviewNavigation,
  htmlPreviewSandbox,
  htmlPreviewShell,
  htmlPreviewTitle,
  readPreviewText,
} from './BucketFileViewer.shared';

const POLICY_META = `<meta http-equiv="Content-Security-Policy" content="${HTML_PREVIEW_POLICY}">`;

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

describe('htmlPreviewSandbox', () => {
  // An unsandboxed srcdoc document inherits the app's origin, and
  // allow-same-origin would hand it back. Forms would post with the reader's
  // cookie in some browsers; modals would be the app's own dialogs; a popup
  // is a top-level window the document opens with no click at all. None may
  // happen, whatever else is allowed.
  it('grants the document nothing but scripts', () => {
    expect(htmlPreviewSandbox({ isElectron: false })).toBe('allow-scripts');
  });

  // The desktop shell disables web security, which grants every document
  // universal access and so defeats the opaque origin.
  it('withholds scripts under Electron', () => {
    expect(htmlPreviewSandbox({ isElectron: true })).toBe('');
  });

  it('grants the native frame scripts and nothing else', () => {
    expect(HTML_PREVIEW_NATIVE_SANDBOX).toBe('allow-scripts');
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

describe('htmlPreviewShell', () => {
  const file = '<!doctype html><p class="x">a & b</p><script>alert(1)</script>';
  const shell = htmlPreviewShell({ document: file, sandbox: 'allow-scripts' });

  // The document inside inherits the shell's policy, so this is the copy the
  // file's own markup cannot reach; its frame-src is also what refuses the
  // frame's own navigation, which only a parent can.
  it('carries the policy in its head', () => {
    expect(shell).toContain(`<head><meta charset="utf-8">${POLICY_META}`);
  });

  it('holds the file in a sandboxed frame, escaped, with no script of its own', () => {
    expect(shell).toContain('<iframe sandbox="allow-scripts" srcdoc="');
    expect(shell).toContain(
      '&lt;p class=&quot;x&quot;&gt;a &amp; b&lt;/p&gt;&lt;script&gt;alert(1)&lt;/script&gt;'
    );
    // The only `<script` is the escaped one inside the attribute.
    expect(shell.match(/<script/g)).toBeNull();
  });
});

describe('htmlPreviewDocument', () => {
  it('places the policy and a new-tab link target after the doctype', () => {
    expect(htmlPreviewDocument('<!doctype html><p>x</p>')).toBe(
      `<!doctype html>${POLICY_META}<base target="_blank"><p>x</p>`
    );
  });

  it('keeps the rest of the document as it was', () => {
    const out = htmlPreviewDocument(
      '<!DOCTYPE html>\n<html><head><title>t</title></head><body>b</body></html>'
    );
    expect(out.startsWith(`<!DOCTYPE html>${POLICY_META}`)).toBe(true);
    expect(out.endsWith('<body>b</body></html>')).toBe(true);
  });

  it('places the policy first when there is no doctype', () => {
    expect(htmlPreviewDocument('<p>hi</p>')).toBe(
      `${POLICY_META}<base target="_blank"><p>hi</p>`
    );
  });

  it('tolerates a byte order mark and whitespace before the doctype', () => {
    expect(htmlPreviewDocument('﻿  <!doctype html><p>x</p>')).toBe(
      `﻿  <!doctype html>${POLICY_META}<base target="_blank"><p>x</p>`
    );
  });

  // A comment or an XML declaration may precede the doctype. The fragment
  // still has to land after the doctype, or the parser drops the doctype and
  // the page goes quirks.
  it('keeps a doctype that follows a comment or an xml declaration', () => {
    expect(
      htmlPreviewDocument('<!-- generated -->\n<!DOCTYPE html>\n<p>x</p>')
    ).toBe(
      `<!-- generated -->\n<!DOCTYPE html>${POLICY_META}<base target="_blank">\n<p>x</p>`
    );
    expect(
      htmlPreviewDocument('<?xml version="1.0"?>\n<!DOCTYPE html>\n<p>x</p>')
    ).toBe(
      `<?xml version="1.0"?>\n<!DOCTYPE html>${POLICY_META}<base target="_blank">\n<p>x</p>`
    );
  });

  // A `>` ends a DOCTYPE token in every tokenizer state, inside a quoted
  // identifier included, so the fragment follows the parser's doctype, not
  // the quote's.
  it('ends the doctype where the parser does', () => {
    expect(htmlPreviewDocument('<!DOCTYPE html SYSTEM "a>b"><p>x</p>')).toBe(
      `<!DOCTYPE html SYSTEM "a>${POLICY_META}<base target="_blank">b"><p>x</p>`
    );
  });
});

describe('htmlPreviewNavigation', () => {
  // The shell and the frame inside it both load as inline documents.
  it('loads the inline documents', () => {
    expect(htmlPreviewNavigation({ url: 'about:blank' })).toBe('load');
    expect(htmlPreviewNavigation({ url: 'about:srcdoc' })).toBe('load');
  });

  // A link, tapped or clicked by a script; a meta refresh; a form; a redirect;
  // another scheme: the document leaving, which it may not.
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
