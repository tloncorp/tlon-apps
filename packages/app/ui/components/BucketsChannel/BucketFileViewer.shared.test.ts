import { describe, expect, it } from 'vitest';

import {
  HTML_PREVIEW_NATIVE_SANDBOX,
  HTML_PREVIEW_POLICY,
  MAX_TEXT_PREVIEW_BYTES,
  canPreviewFromText,
  getBucketPreviewKind,
  htmlPreviewNativeDocument,
  htmlPreviewNavigation,
  htmlPreviewSandbox,
  htmlPreviewShell,
  htmlPreviewWebDocument,
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

describe('htmlPreviewSandbox', () => {
  // An unsandboxed srcdoc document inherits the app's origin, and
  // allow-same-origin would hand it back. Forms would post with the reader's
  // cookie in some browsers; modals would be the app's own dialogs. None may
  // happen, whatever else is allowed.
  it('never grants the document the app origin, forms or dialogs', () => {
    for (const isElectron of [false, true]) {
      const tokens = htmlPreviewSandbox({ isElectron }).split(' ');
      expect(tokens).not.toContain('allow-same-origin');
      expect(tokens).not.toContain('allow-top-navigation');
      expect(tokens).not.toContain('allow-forms');
      expect(tokens).not.toContain('allow-modals');
      expect(tokens).toContain('allow-popups');
      expect(tokens).toContain('allow-popups-to-escape-sandbox');
    }
  });

  it('runs scripts in a browser, where the opaque origin holds', () => {
    expect(htmlPreviewSandbox({ isElectron: false }).split(' ')).toContain(
      'allow-scripts'
    );
  });

  // The desktop shell disables web security, which grants every document
  // universal access and so defeats the opaque origin.
  it('withholds scripts under Electron', () => {
    expect(htmlPreviewSandbox({ isElectron: true }).split(' ')).not.toContain(
      'allow-scripts'
    );
  });

  it('grants the native frame scripts and nothing else', () => {
    expect(HTML_PREVIEW_NATIVE_SANDBOX).toBe('allow-scripts');
  });
});

describe('HTML_PREVIEW_POLICY', () => {
  it('forbids connections, forms, frames and objects', () => {
    for (const directive of [
      "connect-src 'none'",
      "form-action 'none'",
      "frame-src 'none'",
      "object-src 'none'",
    ]) {
      expect(HTML_PREVIEW_POLICY).toContain(directive);
    }
  });
});

describe('htmlPreviewShell', () => {
  const file = '<!doctype html><p class="x">a & b</p><script>alert(1)</script>';
  const shell = htmlPreviewShell({ document: file, sandbox: 'allow-scripts' });

  // A sandboxed frame may navigate itself; only its parent's policy can
  // refuse the destination.
  it('lets only the inline frame load', () => {
    expect(shell).toContain(
      '<meta http-equiv="Content-Security-Policy" content="frame-src about:">'
    );
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

describe('htmlPreviewWebDocument', () => {
  it('places the policy and a new-tab link target after the doctype', () => {
    expect(htmlPreviewWebDocument('<!doctype html><p>x</p>')).toBe(
      `<!doctype html>${HTML_PREVIEW_POLICY}<base target="_blank"><p>x</p>`
    );
  });

  // A comment may precede the doctype. The fragment still has to land after
  // the doctype, or the parser drops the doctype and the page goes quirks.
  it('keeps a doctype that follows a comment first', () => {
    expect(
      htmlPreviewWebDocument('<!-- generated -->\n<!DOCTYPE html>\n<p>x</p>')
    ).toBe(
      `<!-- generated -->\n<!DOCTYPE html>${HTML_PREVIEW_POLICY}<base target="_blank">\n<p>x</p>`
    );
  });
});

describe('htmlPreviewNativeDocument', () => {
  it('places the policy after the doctype, keeping standards mode', () => {
    const out = htmlPreviewNativeDocument(
      '<!DOCTYPE html>\n<html><head><title>t</title></head><body>b</body></html>'
    );
    expect(
      out.startsWith(`<!DOCTYPE html>${HTML_PREVIEW_POLICY}\n<html>`)
    ).toBe(true);
    expect(out.endsWith('<body>b</body></html>')).toBe(true);
  });

  it('places the policy first when there is no doctype', () => {
    expect(htmlPreviewNativeDocument('<p>hi</p>')).toBe(
      `${HTML_PREVIEW_POLICY}<p>hi</p>`
    );
  });

  it('tolerates a byte order mark and whitespace before the doctype', () => {
    expect(htmlPreviewNativeDocument('﻿  <!doctype html><p>x</p>')).toBe(
      `﻿  <!doctype html>${HTML_PREVIEW_POLICY}<p>x</p>`
    );
  });

  it('keeps a doctype that follows a comment first', () => {
    expect(
      htmlPreviewNativeDocument('<!-- generated -->\n<!DOCTYPE html>\n<p>x</p>')
    ).toBe(
      `<!-- generated -->\n<!DOCTYPE html>${HTML_PREVIEW_POLICY}\n<p>x</p>`
    );
  });
});

describe('htmlPreviewNavigation', () => {
  // The shell and the frame inside it both load as inline documents.
  it('loads the inline documents', () => {
    expect(
      htmlPreviewNavigation({ url: 'about:blank', navigationType: 'other' })
    ).toBe('load');
    expect(
      htmlPreviewNavigation({ url: 'about:srcdoc', navigationType: 'other' })
    ).toBe('load');
  });

  it('sends a link the reader taps to the system browser', () => {
    expect(
      htmlPreviewNavigation({
        url: 'https://tlon.io/',
        navigationType: 'click',
      })
    ).toBe('open-externally');
    expect(
      htmlPreviewNavigation({
        url: 'mailto:hi@tlon.io',
        navigationType: 'click',
      })
    ).toBe('open-externally');
  });

  // A meta refresh, a redirect, a form: the document leaving without a tap.
  it('refuses a navigation that is not a tap', () => {
    expect(
      htmlPreviewNavigation({
        url: 'https://evil.example/',
        navigationType: 'other',
      })
    ).toBe('block');
    expect(
      htmlPreviewNavigation({
        url: 'https://evil.example/',
        navigationType: 'formsubmit',
      })
    ).toBe('block');
  });

  it('refuses a tapped link to anything but a web link', () => {
    for (const url of [
      'sms:+15555550100',
      'data:text/html,<p>x</p>',
      'javascript:alert(1)',
    ]) {
      expect(htmlPreviewNavigation({ url, navigationType: 'click' })).toBe(
        'block'
      );
    }
  });

  // Android reports no gesture, so a link there is inert rather than a
  // script's navigation being mistaken for a tap.
  it('refuses everything but the inline documents when the platform says nothing', () => {
    expect(htmlPreviewNavigation({ url: 'about:srcdoc' })).toBe('load');
    expect(htmlPreviewNavigation({ url: 'https://tlon.io/' })).toBe('block');
  });
});
