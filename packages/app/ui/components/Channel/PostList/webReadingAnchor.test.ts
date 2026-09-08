// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { listScrollKeyDirection } from './useWebScrollCoordinator';
import { WebScrollCoordinator } from './webScrollCoordinator';
import {
  captureWebReadingPoints,
  getWebInitialAnchorOffset,
  getWebPostTargetOffset,
  isWebScrollSurfaceVisible,
  visibleWebPostRows,
} from './webReadingAnchor';

// jsdom supplies DOM identity/traversal. Controlled bounds exercise acquisition
// and fallback; the actual-app browser suite proves real layout behavior.
beforeEach(() => {
  // jsdom omits these browser initial computed values unless specified.
  document.head.innerHTML =
    '<style>* { opacity: 1; visibility: visible; }</style>';
  vi.stubGlobal('CSS', { escape: (value: string) => value });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: HTMLElement) {
      const list = this.closest('[data-list]') as HTMLElement | null;
      return new DOMRect(
        0,
        Number(this.dataset.y ?? 0) -
          (this === list ? 0 : (list?.scrollTop ?? 0)),
        600,
        Number(this.dataset.height ?? 20)
      );
    }
  );
  Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: function (this: Range) {
      const element =
        this.startContainer.nodeType === Node.TEXT_NODE
          ? this.startContainer.parentElement!
          : (this.startContainer as Element);
      return element.getBoundingClientRect();
    },
  });
  Object.defineProperty(Range.prototype, 'getClientRects', {
    configurable: true,
    value: function (this: Range) {
      return [this.getBoundingClientRect()];
    },
  });
});
afterEach(() => {
  document.body.innerHTML = '';
  document.head.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function fixture(
  markup = '<div class="is_ContentBlock" data-y="400">unchanged readable paragraph</div>'
) {
  document.body.innerHTML = `<div data-list data-height="699"><div data-content><div><div data-postid="post-a" data-y="0" data-height="800">${markup}</div><div data-postid="post-b" data-y="800" data-height="100"><div class="is_ContentBlock" data-y="820">neighbor</div></div></div></div></div>`;
  const list = document.querySelector<HTMLElement>('[data-list]')!;
  Object.defineProperties(list, {
    clientHeight: { value: 699 },
    clientWidth: { value: 600 },
  });
  return {
    list,
    content: document.querySelector<HTMLElement>('[data-content]')!,
    block: document.querySelector<HTMLElement>('.is_ContentBlock')!,
    row: document.querySelector<HTMLElement>('[data-postid]')!,
  };
}

describe('web interior reading anchor acquisition', () => {
  it('preserves the accepted web center landing for both initial anchor types', () => {
    const { list } = fixture();
    list.scrollTop = 160;
    expect(
      getWebInitialAnchorOffset(list, { type: 'unread', postId: 'post-b' })
    ).toBe(500.5);
    expect(
      getWebInitialAnchorOffset(list, { type: 'selected', postId: 'post-b' })
    ).toBe(500.5);
    expect(getWebPostTargetOffset(list, 'post-b', 1)).toBe(201);
    expect(getWebPostTargetOffset(list, 'missing')).toBeNull();
  });
  it('chooses an exposed paragraph inside a partially clipped tall row', () => {
    const { list, content, block } = fixture();
    list.scrollTop = 160;
    const points = captureWebReadingPoints(list, content);
    expect(points[0].elements).toContain(block);
    expect(points[0].measure()).toBe(240);
    block.dataset.y = '300';
    expect(points[0].measure()).toBe(140);
  });

  it('keeps the acquired paragraph despite unrelated sibling insertion', () => {
    const { list, content, block, row } = fixture();
    const point = captureWebReadingPoints(list, content)[0];
    row.prepend(document.createElement('aside'));
    block.dataset.y = '370';
    expect(point.measure()).toBe(370);
    expect(point.elements).toContain(block);
  });

  it('rebinds a same-content React replacement without confusing DOM and semantic identity', () => {
    const { list, content, block } = fixture();
    const point = captureWebReadingPoints(list, content)[0];
    const replacement = block.cloneNode(true) as HTMLElement;
    replacement.dataset.y = '350';
    block.replaceWith(replacement);
    expect(point.measure()).toBe(350);
    expect(point.elements).toContain(replacement);
  });

  it('refuses edited or ambiguously replaced text instead of inventing a reading point', () => {
    const { list, content, block, row } = fixture();
    const point = captureWebReadingPoints(list, content)[0];
    const copy = block.cloneNode(true);
    block.textContent = 'different revision';
    expect(point.measure()).toBeNull();
    row.append(copy, copy.cloneNode(true));
    expect(point.measure()).toBeNull();
  });

  it('retains a neighboring row witness when the original row disappears', () => {
    const { list, content, row } = fixture();
    list.scrollTop = 200;
    const points = captureWebReadingPoints(list, content);
    row.remove();
    expect(points[0].measure()).toBeNull();
    expect(points.some((point) => point.measure() === 600)).toBe(true);
  });

  it('uses a normalized exposed image interior for a media-only row', () => {
    const { list, content } = fixture('<img data-y="100" data-height="500" />');
    const image = list.querySelector('img')!;
    const point = captureWebReadingPoints(list, content)[0];
    expect(point.elements).toContain(image);
    expect(point.measure()).toBe(349.5);
    image.dataset.height = '250';
    expect(point.measure()).toBe(224.75);
  });

  it('anchors content media rather than its avatar and rejects a replaced source', () => {
    const { list, content } = fixture(
      '<img src="avatar.png" data-y="10" data-height="24" /><div class="is_ContentFrame"><img src="photo.png" data-y="100" data-height="500" /></div>'
    );
    const image = list.querySelector('.is_ContentFrame img')!;
    const point = captureWebReadingPoints(list, content)[0];
    expect(point.elements).toContain(image);
    image.setAttribute('src', 'different.png');
    expect(point.measure()).toBeNull();
  });

  it('does not acquire a hidden child as readable text', () => {
    const { list, content, block } = fixture();
    block.style.visibility = 'hidden';
    const points = captureWebReadingPoints(list, content);
    expect(points.some((point) => point.elements?.includes(block))).toBe(false);
  });

  it('does not acquire opacity-zero text and invalidates a hidden conversation surface', () => {
    const { list, content, block } = fixture();
    block.style.opacity = '0';
    expect(
      captureWebReadingPoints(list, content).some((point) =>
        point.elements?.includes(block)
      )
    ).toBe(false);
    expect(isWebScrollSurfaceVisible(list)).toBe(true);
    list.style.display = 'none';
    expect(isWebScrollSurfaceVisible(list)).toBe(false);
  });

  it('bounds row geometry reads even with ten thousand mounted messages', () => {
    const { list } = fixture();
    list.scrollTop = 500000;
    let measured = 0;
    const children = new Proxy(
      { length: 10000 },
      {
        get: (_target, key) =>
          key === 'length'
            ? 10000
            : {
                dataset: { postid: String(key) },
                getBoundingClientRect: () => {
                  measured++;
                  return new DOMRect(
                    0,
                    Number(key) * 100 - list.scrollTop,
                    600,
                    100
                  );
                },
              },
      }
    );
    const content = {
      firstElementChild: { children },
    } as unknown as HTMLElement;
    expect(visibleWebPostRows(list, content)).toHaveLength(7);
    expect(measured).toBeLessThan(30);
  });
});

describe('list keyboard ownership', () => {
  const event = (target: Element, key: string) => ({
    target,
    key,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    defaultPrevented: false,
  });
  it.each(['textarea', 'input', 'button', 'select', 'a'])(
    'does not consume%s navigation keys',
    (tag) => {
      const target = document.createElement(tag);
      expect(listScrollKeyDirection(event(target, 'ArrowUp'))).toBeNull();
      expect(listScrollKeyDirection(event(target, ' '))).toBeNull();
    }
  );
  it('ignores descendants of editable composer and already-handled keys', () => {
    const editor = document.createElement('div');
    editor.contentEditable = 'true';
    editor.setAttribute('contenteditable', 'true');
    const child = editor.appendChild(document.createElement('span'));
    expect(listScrollKeyDirection(event(child, 'PageUp'))).toBeNull();
    expect(
      listScrollKeyDirection({
        ...event(document.body, 'PageUp'),
        defaultPrevented: true,
      })
    ).toBeNull();
  });
  it('recognizes only actual list scrolling keys', () => {
    expect(listScrollKeyDirection(event(document.body, 'ArrowUp'))).toBe(-1);
    expect(listScrollKeyDirection(event(document.body, 'End'))).toBe(1);
    expect(listScrollKeyDirection(event(document.body, 'Enter'))).toBeNull();
    expect(listScrollKeyDirection(event(document.body, 'x'))).toBeNull();
  });
});

describe('accepted next-row fallback after removing the reading anchor', () => {
  function multiRowFixture() {
    const { list, content } = fixture();
    content.firstElementChild!.innerHTML = [
      ['older', 300, 150, 400],
      ['previous', 450, 150, 580],
      ['primary', 600, 120, 645],
      ['next', 720, 150, 850],
      ['next-again', 870, 110, 930],
    ]
      .map(
        ([id, y, height, textY]) =>
          `<div data-postid="${id}" data-y="${y}" data-height="${height}"><div class="is_ContentBlock" data-y="${textY}">${id} original text</div>${id === 'primary' ? '<div class="is_ContentBlock" data-y="670">primary second paragraph</div>' : ''}</div>`
      )
      .join('');
    list.scrollTop = 300;
    const rows = Object.fromEntries(
      Array.from(content.querySelectorAll<HTMLElement>('[data-postid]')).map(
        (row) => [row.dataset.postid!, row]
      )
    );
    const points = captureWebReadingPoints(list, content);
    const saved = points.map((point) => ({ point, y: point.measure()! }));
    const firstSurvivor = () =>
      saved.find(({ point }) => point.measure() !== null)!;
    let maximum = 1000;
    const owner = new WebScrollCoordinator({
      offset: () => list.scrollTop,
      maximum: () => maximum,
      write: (top) => {
        list.scrollTop = top;
      },
      visible: () => true,
      capture: () => points,
    });
    owner.configure('channel', true, false);
    owner.navigate(() => list.scrollTop, false, false, false);
    const remove = (id: string) => {
      const row = rows[id],
        removedY = Number(row.dataset.y),
        removedHeight = Number(row.dataset.height);
      row.remove();
      for (const other of Object.values(rows)) {
        if (!other.isConnected || Number(other.dataset.y) <= removedY) continue;
        other.dataset.y = String(Number(other.dataset.y) - removedHeight);
        for (const block of Array.from(
          other.querySelectorAll<HTMLElement>('.is_ContentBlock')
        ))
          block.dataset.y = String(Number(block.dataset.y) - removedHeight);
      }
      maximum -= removedHeight;
    };
    return {
      list,
      rows,
      owner,
      saved,
      firstSurvivor,
      remove,
      setMaximum: (value: number) => {
        maximum = value;
      },
    };
  }

  it('keeps a surviving interior point in the primary row before any neighboring text', () => {
    const { rows, firstSurvivor } = multiRowFixture();
    rows.primary.querySelector('.is_ContentBlock')!.remove();
    expect(firstSurvivor().point.elements).toContain(rows.primary);
    expect(firstSurvivor().point.elements).toContain(
      rows.primary.querySelector('.is_ContentBlock')
    );
  });

  it('uses the primary row boundary when all its captured text disappears', () => {
    const { rows, firstSurvivor } = multiRowFixture();
    rows.primary.replaceChildren();
    expect(firstSurvivor().point.elements).toEqual([rows.primary]);
  });

  it('prefers the next visible row even when previous text was closer to the reading center', () => {
    const { rows, firstSurvivor, remove, owner, list } = multiRowFixture();
    remove('primary');
    const chosen = firstSurvivor();
    expect(chosen.point.elements).toContain(rows.next);
    owner.reconcile();
    expect(list.scrollTop).toBe(180);
    expect(chosen.point.measure()).toBe(chosen.y);
  });

  it('continues forward to the next surviving row when primary and its immediate successor disappear', () => {
    const { rows, firstSurvivor, remove, owner, list } = multiRowFixture();
    remove('primary');
    remove('next');
    const chosen = firstSurvivor();
    expect(chosen.point.elements).toContain(rows['next-again']);
    owner.reconcile();
    expect(list.scrollTop).toBe(30);
    expect(chosen.point.measure()).toBe(chosen.y);
  });

  it('uses the nearest previous row only when no saved next row survives', () => {
    const { rows, firstSurvivor, remove, owner, list } = multiRowFixture();
    remove('primary');
    remove('next');
    remove('next-again');
    const chosen = firstSurvivor();
    expect(chosen.point.elements).toContain(rows.previous);
    owner.reconcile();
    expect(list.scrollTop).toBe(300);
    expect(chosen.point.measure()).toBe(chosen.y);
  });

  it('continues backward if the nearest previous row is also removed', () => {
    const { rows, firstSurvivor, remove } = multiRowFixture();
    for (const id of ['primary', 'next', 'next-again', 'previous']) remove(id);
    expect(firstSurvivor().point.elements).toContain(rows.older);
  });

  it('clamps once when every saved row disappears and does not acquire FOLLOW', () => {
    const { remove, owner, list, setMaximum } = multiRowFixture();
    for (const id of ['primary', 'next', 'next-again', 'previous', 'older'])
      remove(id);
    setMaximum(0);
    owner.reconcile();
    expect(list.scrollTop).toBe(0);
    setMaximum(900);
    owner.reconcile();
    expect(list.scrollTop).toBe(0);
  });
});

describe('desktop initial unread and selected center policy', () => {
  const cases = [
    {
      name: 'ordinary bordered viewport',
      scroll: 300,
      listTop: 100,
      border: 2,
      viewport: 400,
      rowTop: 600,
      rowHeight: 80,
      expected: 638,
    },
    {
      name: 'oversized target',
      scroll: 160,
      listTop: 0,
      border: 0,
      viewport: 699,
      rowTop: -160,
      rowHeight: 800,
      expected: 50.5,
    },
    {
      name: 'near boundary before legal clamp',
      scroll: 0,
      listTop: 45,
      border: 0,
      viewport: 699,
      rowTop: 45,
      rowHeight: 100,
      expected: -299.5,
    },
  ];
  for (const type of ['unread', 'selected'] as const) {
    it.each(cases)(`${type} independently centers $name`, (f) => {
      const list = document.body.appendChild(document.createElement('div'));
      list.dataset.list = '';
      list.dataset.y = String(f.listTop);
      Object.defineProperties(list, {
        clientHeight: { value: f.viewport },
        clientTop: { value: f.border },
      });
      list.scrollTop = f.scroll;
      const row = list.appendChild(document.createElement('div'));
      row.dataset.postid = 'target';
      row.dataset.y = String(f.rowTop + f.scroll);
      row.dataset.height = String(f.rowHeight);
      expect(getWebInitialAnchorOffset(list, { type, postId: 'target' })).toBe(
        f.expected
      );
    });
  }
});
