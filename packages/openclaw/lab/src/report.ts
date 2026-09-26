import type { PairVerdict } from './judge.js';
import type { RunRecord, RunSetManifest, TranscriptEvent } from './types.js';

export type Metrics = {
  runs: number;
  errors: number;
  outcomeMatched: number | null;
  conversation: number | null;
  result: number | null;
  followUpOk: number | null;
  keep: number | null;
  ruleBreaks: number | null;
  questions: number;
  userTurns: number;
  costUsd: number;
};

const mean = (values: number[]) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
const rate = (values: boolean[]) =>
  values.length ? values.filter(Boolean).length / values.length : null;

export function metrics(runs: RunRecord[]): Metrics {
  const graded = runs.filter((run) => run.judgement);
  return {
    runs: runs.length,
    errors: runs.filter((run) => run.error).length,
    outcomeMatched: rate(graded.map((run) => run.judgement!.outcome.matched)),
    conversation: mean(
      graded
        .map((run) => run.judgement!.conversation.score)
        .filter((score): score is number => typeof score === 'number')
    ),
    result: mean(
      graded
        .map((run) => run.judgement!.result.score)
        .filter((score): score is number => typeof score === 'number')
    ),
    followUpOk: rate(graded.map((run) => run.judgement!.followUp.ok)),
    keep: rate(runs.filter((run) => run.keep).map((run) => run.keep!.keep)),
    ruleBreaks: mean(graded.map((run) => run.judgement!.ruleBreaks.length)),
    questions: mean(runs.map((run) => run.facts.choicesPosted)) ?? 0,
    userTurns: mean(runs.map((run) => run.facts.userTurns)) ?? 0,
    costUsd: runs.reduce((sum, run) => sum + run.costUsd, 0),
  };
}

const METRIC_ROWS: [
  keyof Metrics,
  string,
  'pct' | 'score' | 'num' | 'usd',
  1 | -1,
][] = [
  ['outcomeMatched', 'Ending matched what the person wanted', 'pct', 1],
  ['conversation', 'Conversation score (1–5)', 'score', 1],
  ['result', 'First result score (1–5)', 'score', 1],
  ['followUpOk', 'Handled the follow-up normally', 'pct', 1],
  ['keep', 'Person got what they came for and would come back', 'pct', 1],
  ['ruleBreaks', 'Skill rule breaks per run', 'num', -1],
  ['questions', 'Pickers per run', 'num', -1],
  ['userTurns', 'User messages before the ending', 'num', -1],
  ['costUsd', 'Total cost', 'usd', -1],
];

function format(value: number | null, kind: 'pct' | 'score' | 'num' | 'usd') {
  if (value === null || Number.isNaN(value)) return '—';
  if (kind === 'pct') return `${Math.round(value * 100)}%`;
  if (kind === 'usd') return `$${value.toFixed(2)}`;
  return value.toFixed(kind === 'score' ? 2 : 1);
}

const escape = (text: string | undefined) =>
  String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const STYLE = `
:root { --bg:#fbfbfa; --panel:#fff; --text:#1d1d1b; --muted:#6b6b66; --line:#e4e3de; --bot:#f1f0ec; --user:#dbe8ff; --good:#1f7a3f; --bad:#b3261e; --accent:#2f5bd3; }
@media (prefers-color-scheme: dark) { :root { --bg:#161615; --panel:#1f1f1d; --text:#ecebe6; --muted:#9d9c95; --line:#34332f; --bot:#2a2a27; --user:#23344f; --good:#5cc27f; --bad:#ff8a80; --accent:#8fb0ff; } }
* { box-sizing: border-box; }
body { margin:0; background:var(--bg); color:var(--text); font:15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
main { max-width: 1100px; margin: 0 auto; padding: 24px 16px 64px; }
h1 { font-size: 22px; margin: 0 0 4px; } h2 { font-size: 17px; margin: 28px 0 8px; } h3 { font-size: 15px; margin: 16px 0 6px; }
.muted { color: var(--muted); font-size: 13px; }
table { border-collapse: collapse; width: 100%; background: var(--panel); border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
th, td { text-align: left; padding: 7px 10px; border-bottom: 1px solid var(--line); vertical-align: top; font-size: 14px; }
th { font-weight: 600; color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: .03em; }
td.num { font-variant-numeric: tabular-nums; }
.good { color: var(--good); } .bad { color: var(--bad); }
.scroll { overflow-x: auto; }
details { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; margin: 10px 0; padding: 0 14px; }
summary { cursor: pointer; padding: 10px 0; font-weight: 600; }
.chat { display: flex; flex-direction: column; gap: 6px; margin: 8px 0 14px; }
.msg { max-width: 80%; padding: 8px 11px; border-radius: 12px; white-space: pre-wrap; font-size: 14px; }
.msg.bot { background: var(--bot); align-self: flex-start; }
.msg.user { background: var(--user); align-self: flex-end; }
.msg.note { background: transparent; border: 1px dashed var(--line); align-self: stretch; max-width: 100%; }
.msg.meta { background: transparent; color: var(--muted); font-size: 12px; padding: 2px 4px; align-self: center; }
.opts { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
.opt { border: 1px solid var(--line); border-radius: 999px; padding: 2px 9px; font-size: 13px; background: var(--panel); }
.card { border-left: 3px solid var(--accent); }
.issue { margin: 4px 0; font-size: 14px; } .issue q { color: var(--muted); }
.pair { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
@media (max-width: 760px) { .pair { grid-template-columns: 1fr; } .msg { max-width: 92%; } }
`;

function renderChat(events: TranscriptEvent[]) {
  const parts = events.map((event) => {
    if (event.from === 'user') {
      if (event.kind === 'leave') {
        return `<div class="msg meta">user left: ${escape(event.reason)}</div>`;
      }
      return `<div class="msg user">${escape(event.text)}${event.kind === 'pick' ? ' <span class="muted">(tapped)</span>' : ''}</div>`;
    }
    if (event.from === 'system') {
      if (event.kind === 'phase') {
        return '<div class="msg meta">— after the ending —</div>';
      }
      return event.ok
        ? `<div class="msg note"><div class="muted">First result in Updates</div>${escape(event.markdown)}</div>`
        : '<div class="msg meta bad">first run produced nothing</div>';
    }
    switch (event.kind) {
      case 'text':
        return `<div class="msg bot">${escape(event.text)}${event.source === 'coordinator' ? ' <span class="muted">(coordinator)</span>' : ''}</div>`;
      case 'choice':
        return `<div class="msg bot">${escape(event.choice.question)}<div class="opts">${event.choice.options
          .map((option) => `<span class="opt">${escape(option)}</span>`)
          .join('')}<span class="opt muted">Write your own…</span></div></div>`;
      case 'plan':
        return `<div class="msg bot card">${escape(event.plan.summary)}<div class="muted">runs ${escape(event.plan.scheduleDescription)} · ${event.plan.scheduleHour}:${String(event.plan.scheduleMinute).padStart(2, '0')} · ${escape(event.plan.purposeId)}</div></div>`;
      case 'service-setup':
        return `<div class="msg bot card">Connect ${escape(event.providerId)}</div>`;
      case 'silent':
        return '<div class="msg meta">(no visible reply)</div>';
      case 'suppressed':
        return `<div class="msg meta">hidden narration: ${escape(event.text)}</div>`;
    }
  });
  return `<div class="chat">${parts.join('')}</div>`;
}

function renderRunDetails(run: RunRecord, heading?: string) {
  const judgement = run.judgement;
  const issues = judgement
    ? [
        ...judgement.conversation.issues.map(
          (i) => ['conversation', i] as const
        ),
        ...judgement.result.issues.map((i) => ['result', i] as const),
      ]
    : [];
  return `
    ${heading ? `<h3>${escape(heading)}</h3>` : ''}
    ${run.error ? `<p class="bad">Error: ${escape(run.error)}</p>` : ''}
    ${judgement ? `<p>${escape(judgement.summary)}</p>` : ''}
    ${issues.length ? `<div>${issues.map(([area, issue]) => `<div class="issue"><b>${area}:</b> <q>${escape(issue.quote)}</q> — ${escape(issue.problem)}</div>`).join('')}</div>` : ''}
    ${judgement?.ruleBreaks.length ? `<div>${judgement.ruleBreaks.map((rule) => `<div class="issue"><b>rule:</b> ${escape(rule.rule)} — <q>${escape(rule.quote)}</q></div>`).join('')}</div>` : ''}
    ${judgement ? `<div class="issue"><b>ending:</b> ${escape(judgement.outcome.why)}</div><div class="issue"><b>follow-up:</b> ${escape(judgement.followUp.why)}</div>` : ''}
    ${run.keep ? `<div class="issue"><b>person:</b> “${escape(run.keep.why)}”</div>` : ''}
    ${renderChat(run.transcript)}
    ${run.secondResult ? `<div class="msg note"><div class="muted">Day two (judge only)</div>${escape(run.secondResult.markdown)}</div>` : ''}
    <div class="muted">tools: ${escape(
      Object.entries(run.facts.toolCounts)
        .map(([name, n]) => `${name}×${n}`)
        .join(', ') || 'none'
    )} · blocked ${run.facts.blockedToolCalls} · errors ${run.facts.toolErrors} · ${(run.durationMs / 1000).toFixed(0)}s · $${run.costUsd.toFixed(3)}</div>
  `;
}

const mark = (ok: boolean | undefined | null) =>
  ok === undefined || ok === null
    ? '—'
    : ok
      ? '<span class="good">✓</span>'
      : '<span class="bad">✗</span>';

function page(title: string, body: string) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(title)}</title><style>${STYLE}</style></head><body><main>${body}</main></body></html>`;
}

function manifestLine(manifest: RunSetManifest) {
  return `<p class="muted">${escape(manifest.createdAt)} · ${escape(manifest.gitRev)}${manifest.gitDirty ? ' (uncommitted changes)' : ''} · bot ${escape(manifest.models.bot)} · user ${escape(manifest.models.user)} · judge ${escape(manifest.models.judge)}${manifest.variant ? ` · variant ${escape(manifest.variant)}` : ''}</p>`;
}

export function renderRunSetReport(
  manifest: RunSetManifest,
  runs: RunRecord[]
) {
  const m = metrics(runs);
  const summary = METRIC_ROWS.map(
    ([key, label, kind]) =>
      `<tr><td>${label}</td><td class="num">${format(m[key] as number | null, kind)}</td></tr>`
  ).join('');
  const rows = runs
    .map(
      (run) => `<tr>
        <td>${escape(run.persona.id)} #${run.repeat}</td>
        <td>${escape(run.facts.ending)}</td>
        <td>${mark(run.judgement?.outcome.matched)}</td>
        <td class="num">${run.judgement?.conversation.score ?? '—'}</td>
        <td class="num">${run.judgement?.result.score ?? '—'}</td>
        <td>${mark(run.judgement?.followUp.ok)}</td>
        <td class="num">${run.judgement?.ruleBreaks.length ?? '—'}</td>
        <td>${mark(run.keep?.keep)}</td>
        <td class="num">${run.facts.choicesPosted}</td>
        <td class="num">$${run.costUsd.toFixed(3)}</td>
      </tr>`
    )
    .join('');
  const details = runs
    .map(
      (run) =>
        `<details><summary>${escape(run.persona.id)} #${run.repeat} — ${escape(run.persona.wants)}</summary>${renderRunDetails(run)}</details>`
    )
    .join('');
  return page(
    `Onboarding lab: ${manifest.label}`,
    `<h1>Onboarding lab: ${escape(manifest.label)}</h1>${manifestLine(manifest)}
     <h2>Summary</h2><table>${summary}</table>
     <h2>Runs</h2><div class="scroll"><table><tr><th>Persona</th><th>Ending</th><th>Matched</th><th>Conv</th><th>Result</th><th>Follow-up</th><th>Rule breaks</th><th>Came for it</th><th>Pickers</th><th>Cost</th></tr>${rows}</table></div>
     <h2>Transcripts</h2>${details}`
  );
}

export type ComparePair = {
  persona: string;
  repeat: number;
  a: RunRecord;
  b: RunRecord;
  verdict: PairVerdict;
};

export function renderCompareReport(input: {
  a: { manifest: RunSetManifest; runs: RunRecord[] };
  b: { manifest: RunSetManifest; runs: RunRecord[] };
  pairs: ComparePair[];
}) {
  const ma = metrics(input.a.runs);
  const mb = metrics(input.b.runs);
  const metricRows = METRIC_ROWS.map(([key, label, kind, better]) => {
    const va = ma[key] as number | null;
    const vb = mb[key] as number | null;
    const delta = va !== null && vb !== null ? vb - va : null;
    const cls =
      delta === null || delta === 0 || key === 'costUsd'
        ? ''
        : delta * better > 0
          ? 'good'
          : 'bad';
    return `<tr><td>${label}</td><td class="num">${format(va, kind)}</td><td class="num">${format(vb, kind)}</td><td class="num ${cls}">${delta === null ? '—' : `${delta > 0 ? '+' : ''}${format(delta, kind)}`}</td></tr>`;
  }).join('');
  const personas = [...new Set(input.pairs.map((pair) => pair.persona))];
  const wins = { A: 0, B: 0, tie: 0 };
  for (const pair of input.pairs) wins[pair.verdict.winner]++;
  const personaRows = personas
    .map((persona) => {
      const pairs = input.pairs.filter((pair) => pair.persona === persona);
      const count = (winner: PairVerdict['winner']) =>
        pairs.filter((pair) => pair.verdict.winner === winner).length;
      return `<tr><td>${escape(persona)}</td><td class="num">${count('A')}</td><td class="num">${count('B')}</td><td class="num">${count('tie')}</td></tr>`;
    })
    .join('');
  const details = input.pairs
    .map(
      (
        pair
      ) => `<details><summary>${escape(pair.persona)} #${pair.repeat} — winner: ${pair.verdict.winner === 'tie' ? 'tie' : pair.verdict.winner === 'A' ? escape(input.a.manifest.label) : escape(input.b.manifest.label)}</summary>
        <p>${escape(pair.verdict.why)}</p>
        <div class="pair"><div>${renderRunDetails(pair.a, `A: ${input.a.manifest.label}`)}</div><div>${renderRunDetails(pair.b, `B: ${input.b.manifest.label}`)}</div></div>
      </details>`
    )
    .join('');
  return page(
    `Onboarding lab: ${input.a.manifest.label} vs ${input.b.manifest.label}`,
    `<h1>${escape(input.a.manifest.label)} (A) vs ${escape(input.b.manifest.label)} (B)</h1>
     ${manifestLine(input.a.manifest)}${manifestLine(input.b.manifest)}
     <h2>Head to head</h2><p>B won ${wins.B}, A won ${wins.A}, ${wins.tie} ties, out of ${input.pairs.length} pairs judged side by side.</p>
     <div class="scroll"><table><tr><th>Persona</th><th>A wins</th><th>B wins</th><th>Ties</th></tr>${personaRows}</table></div>
     <h2>Scores</h2><div class="scroll"><table><tr><th>Measure</th><th>A</th><th>B</th><th>B − A</th></tr>${metricRows}</table></div>
     <h2>Side by side</h2>${details}`
  );
}
