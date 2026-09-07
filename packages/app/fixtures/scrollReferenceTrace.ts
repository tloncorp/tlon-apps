import type {
  assessScrollReadingTrace,
  ReadingFragment,
  ScrollReadingContract,
  ScrollReadingTrace,
} from './scrollReadingTrace';

export type ScrollReferenceContract = {
  reading: ScrollReadingContract;
  beforeText: string;
  afterText: string;
  forbiddenTexts: string[];
  actionTime: number;
  authorSelector: string;
  authorLabel: string;
};

/** Actual reference text phases plus an unchanged interior reading character. */
export function assessScrollReferenceTrace(
  trace: ScrollReadingTrace,
  contract: ScrollReferenceContract,
  evaluateReading: typeof assessScrollReadingTrace
) {
  const reading = evaluateReading(trace, contract.reading);
  const issues = [...reading.issues];
  const add = (
    code: string,
    kind: 'failure' | 'incomplete',
    sampleIndex?: number
  ) => issues.push({ code, kind, sampleIndex });
  const expected = [
    contract.beforeText,
    contract.afterText,
    ...contract.forbiddenTexts,
  ];
  if (
    expected.some((text) => typeof text !== 'string' || !text) ||
    contract.authorSelector !== '.is_PostReferenceAuthorName' ||
    !contract.authorLabel ||
    new Set(expected).size !== expected.length ||
    !Number.isFinite(contract.actionTime) ||
    contract.actionTime - contract.reading.coverage.startTime < 200 ||
    contract.actionTime > contract.reading.terminalTime ||
    contract.reading.terminalTime - contract.actionTime > 10_000
  ) {
    add('invalid-reference-phase-contract', 'incomplete');
  }
  const validFragment = (fragment: ReadingFragment) => {
    const p = fragment?.presentation;
    const validBox = (r: typeof p.rect) =>
      r &&
      [r.left, r.top, r.width, r.height, r.right, r.bottom].every(
        Number.isFinite
      ) &&
      r.width >= 0 &&
      r.height >= 0 &&
      Math.abs(r.right - r.left - r.width) < 0.01 &&
      Math.abs(r.bottom - r.top - r.height) < 0.01;
    return (
      p &&
      typeof p.connected === 'boolean' &&
      typeof p.displayed === 'boolean' &&
      Number.isFinite(p.opacity) &&
      p.opacity >= 0 &&
      p.opacity <= 1 &&
      validBox(p.rect) &&
      validBox(p.clip) &&
      (!(p.clip.width > 0 && p.clip.height > 0) ||
        (p.clip.left >= p.rect.left - 0.01 &&
          p.clip.top >= p.rect.top - 0.01 &&
          p.clip.right <= p.rect.right + 0.01 &&
          p.clip.bottom <= p.rect.bottom + 0.01)) &&
      Number.isFinite(fragment.textAlpha) &&
      fragment.textAlpha >= 0 &&
      fragment.textAlpha <= 1 &&
      typeof fragment.pointerEvents === 'string' &&
      Array.isArray(fragment.hits) &&
      fragment.hits.every(
        (hit) =>
          Number.isFinite(hit.x) &&
          Number.isFinite(hit.y) &&
          Array.isArray(hit.stack) &&
          hit.stack.every(
            (entry) =>
              ['owner', 'ancestor', 'foreign'].includes(entry.relation) &&
              typeof entry.tag === 'string'
          )
      )
    );
  };
  let sawReady = false;
  let beforeSamples = 0;
  let readyTail = 0;
  trace.samples.forEach((sample, index) => {
    const observations = sample.observations;
    if (
      !Array.isArray(observations) ||
      observations.length !== expected.length ||
      expected.some(
        (text) =>
          observations.filter((item) => item?.text === text).length !== 1
      ) ||
      observations.some(
        (item) =>
          !Number.isInteger(item.count) ||
          item.count < 0 ||
          !Array.isArray(item.fragments) ||
          !item.fragments.every(validFragment)
      )
    ) {
      add('missing-reference-text-observations', 'incomplete', index);
      return;
    }
    const before = observations.find(
      (item) => item.text === contract.beforeText
    )!;
    const after = observations.find(
      (item) => item.text === contract.afterText
    )!;
    if (
      observations.some(
        (item) => contract.forbiddenTexts.includes(item.text) && item.count > 0
      )
    )
      add('unexpected-reference-state', 'failure', index);
    if (before.count + after.count !== 1)
      add('blank-or-duplicate-reference', 'failure', index);
    if (sample.time < contract.actionTime) {
      beforeSamples++;
      if (before.count !== 1)
        add('reference-changed-before-action', 'failure', index);
    }
    if (sawReady && after.count !== 1)
      add('reference-ready-reverted', 'failure', index);
    sawReady ||= after.count === 1;
    if (sample.time >= contract.reading.terminalTime) {
      readyTail++;
      if (after.count !== 1) add('wrong-terminal-reference', 'failure', index);
    }
    const current = after.count === 1 ? after : before;
    const authors = sample.elements?.filter(
      (element) => element.selector === contract.authorSelector
    );
    const author = authors?.[0];
    if (
      authors?.length !== 1 ||
      !author ||
      !Number.isInteger(author.count) ||
      !Array.isArray(author.texts) ||
      author.texts.length !== author.count ||
      !Array.isArray(author.fragments) ||
      !author.fragments.every(validFragment)
    ) {
      add('missing-reference-author-observation', 'incomplete', index);
    } else if (
      current.text !== 'Loading remote content...' &&
      (author.count !== 1 ||
        author.texts[0].replace(/\u2060/g, '') !== contract.authorLabel)
    ) {
      add('wrong-reference-author', 'failure', index);
    }
    const exposed = current.fragments.filter(
      (fragment) =>
        fragment.presentation.clip.width > 0 &&
        fragment.presentation.clip.height > 0
    );
    if (!exposed.length) add('reference-has-no-exposed-text', 'failure', index);
    const exposedAuthor =
      current.text !== 'Loading remote content...' && author
        ? author.fragments.filter(
            (fragment) =>
              fragment.presentation.clip.width > 0 &&
              fragment.presentation.clip.height > 0
          )
        : [];
    if (current.text !== 'Loading remote content...' && !exposedAuthor.length)
      add('reference-author-has-no-exposed-text', 'failure', index);
    for (const fragment of [...exposed, ...exposedAuthor]) {
      const p = fragment.presentation;
      if (
        !p.connected ||
        !p.displayed ||
        p.opacity < 0.99 ||
        fragment.textAlpha < 0.99
      )
        add('reference-text-hidden', 'failure', index);
      if (
        fragment.hits.length !== 3 ||
        fragment.hits.some(
          (hit, i) =>
            Math.abs(
              hit.x - (p.clip.left + p.clip.width * [0.1, 0.5, 0.9][i])
            ) > 0.01 ||
            Math.abs(hit.y - (p.clip.top + p.clip.height / 2)) > 0.01 ||
            !hit.stack.length
        )
      )
        add('missing-reference-hit-witness', 'incomplete', index);
      else if (
        fragment.hits.some(
          (hit) =>
            hit.stack[0].relation !== 'owner' &&
            !(
              fragment.pointerEvents === 'none' &&
              hit.stack[0].relation === 'ancestor'
            )
        )
      )
        add('reference-text-obstructed', 'failure', index);
    }
  });
  if (!sawReady || beforeSamples < 3 || readyTail < 6)
    add('missing-reference-phase', 'incomplete');
  return {
    verdict: issues.some((issue) => issue.kind === 'incomplete')
      ? 'INCOMPLETE'
      : issues.length
        ? 'FAIL'
        : 'PASS',
    issues,
    reading,
    evidenceLevel: 'sampled-dom-reference-and-reading-point',
    presentedFrames: 'INCOMPLETE',
  };
}
