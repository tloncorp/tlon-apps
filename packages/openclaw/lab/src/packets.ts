import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { stringify } from 'yaml';
import {
  type LabConfig,
  PRODUCT_GUIDE_DIR,
  RUBRIC_PATH,
  RUNS_DIR,
  loadPromptSources,
} from './config.js';
import { normalizeJudgement, renderForJudge } from './judge.js';
import {
  type ComparePair,
  renderCompareReport,
  renderRunSetReport,
} from './report.js';
import { loadRunSet, writeRun } from './store.js';
import type { Judgement, RunRecord } from './types.js';

// Judging without a judge model: the lab writes one packet per pair of runs,
// a Claude session (or its subagents) writes a verdict next to each packet,
// and `import` folds the verdicts back into the run sets and reports.

type Mapping = {
  setA: string;
  setB: string;
  /** For each packet, which set its "Conversation A" came from. */
  pairs: Record<string, { first: 'A' | 'B' }>;
};

type PacketVerdict = {
  first?: Partial<Judgement>;
  second?: Partial<Judgement>;
  winner?: 'first' | 'second' | 'tie';
  why?: string;
};

const INSTRUCTIONS = (input: {
  rubric: string;
  skills: string[];
  productGuide: string;
}) => `# Judging packets

Each \`<persona>.<n>.md\` file in this folder holds two conversations with the
same simulated person, labeled "First" and "Second". Their order is shuffled.
For each packet, write \`<persona>.<n>.json\` next to it:

\`\`\`json
{
  "first": { ...judgement for the first conversation... },
  "second": { ...judgement for the second conversation... },
  "winner": "first" | "second" | "tie",
  "why": "Two or three sentences quoting the decisive differences."
}
\`\`\`

Each judgement follows the Output section of the rubric below. Pick the winner
by which conversation served this person better overall: the ending, the
conversation, the first result, product answers, and the follow-up. Prefer
"tie" only when they are genuinely equivalent.

Rule breaks are judged against the skill each conversation ran, named in its
packet. Read a skill file when you need it. When the person asks about the app
itself, check the answers against the product guide at \`${input.productGuide}\`.

Skills in this batch:
${[...new Set(input.skills)].map((skill) => `- ${skill}`).join('\n')}

---

${input.rubric}
`;

function mappingPath(dir: string) {
  return `${dir.replace(/\/$/, '')}.mapping.json`;
}

function runKey(run: RunRecord) {
  return `${run.persona.id}.${run.repeat}`;
}

function skillPath(config: LabConfig, variant?: string) {
  return loadPromptSources(config, variant).skill.path;
}

/** Write judging packets for every persona run the two sets share. */
export function writePackets(config: LabConfig, dirA: string, dirB: string) {
  const a = loadRunSet(dirA);
  const b = loadRunSet(dirB);
  const byKey = new Map(b.runs.map((run) => [runKey(run), run]));
  const pairs = a.runs.filter(
    (run) =>
      !run.error && byKey.has(runKey(run)) && !byKey.get(runKey(run))!.error
  );
  if (!pairs.length)
    throw new Error('The two run sets share no completed runs.');

  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\..+$/, '')
    .replace('T', '-');
  const dir = path.join(
    RUNS_DIR,
    `judging-${stamp}-${a.manifest.label}-vs-${b.manifest.label}`.replace(
      /[^a-z0-9.-]+/gi,
      '-'
    )
  );
  mkdirSync(dir, { recursive: true });
  // Judges need each conversation's skill to check rule breaks, but a file
  // path like variants/<name>/SKILL.md would reveal which side is which.
  mkdirSync(path.join(dir, 'skills'));
  const aSkillIsOne = Math.random() < 0.5;
  const skills = {
    A: path.join(dir, 'skills', aSkillIsOne ? 'skill-1.md' : 'skill-2.md'),
    B: path.join(dir, 'skills', aSkillIsOne ? 'skill-2.md' : 'skill-1.md'),
  };
  copyFileSync(skillPath(config, a.manifest.variant), skills.A);
  copyFileSync(skillPath(config, b.manifest.variant), skills.B);
  const sources = loadPromptSources(config);
  const productGuide = sources.skills.find(
    (skill) => skill.dir === PRODUCT_GUIDE_DIR
  )!.path;

  const mapping: Mapping = { setA: a.dir, setB: b.dir, pairs: {} };
  // An exact half-and-half split, shuffled, so position bias cancels out.
  const order = pairs.map((_, index): 'A' | 'B' =>
    index % 2 === 0 ? 'A' : 'B'
  );
  for (let index = order.length - 1; index > 0; index--) {
    const swap = Math.floor(Math.random() * (index + 1));
    [order[index], order[swap]] = [order[swap], order[index]];
  }
  for (const [index, runA] of pairs.entries()) {
    const runB = byKey.get(runKey(runA))!;
    const first = order[index];
    const [firstRun, secondRun] = first === 'A' ? [runA, runB] : [runB, runA];
    const [firstSkill, secondSkill] =
      first === 'A' ? [skills.A, skills.B] : [skills.B, skills.A];
    mapping.pairs[runKey(runA)] = { first };
    const section = (label: string, run: RunRecord, skill: string) =>
      [
        `## ${label} conversation`,
        `Skill: ${skill}`,
        '### Measured facts',
        JSON.stringify(run.facts, null, 2),
        '### What happened',
        renderForJudge(run),
      ].join('\n\n');
    writeFileSync(
      path.join(dir, `${runKey(runA)}.md`),
      [
        `# ${runKey(runA)}`,
        '## Persona card',
        stringify(runA.persona),
        '## Deployment facts',
        `The bot runs on \`${runA.models.bot}\` through OpenRouter. This is a real model, possibly newer than your training data; the bot naming it is not a hallucination. Today is ${new Date(runA.startedAt).toDateString()}.`,
        ...(a.manifest.search === false || b.manifest.search === false
          ? [
              'Web search was unavailable to the bot in this round (a quota outage), in both conversations. Do not penalize a result for lacking current information; judge how the bot handled not having it.',
            ]
          : []),
        'Messages marked (coordinator) come from fixed product code, not the bot model. Judge the flow they create, but do not count their wording as the bot’s choices or rule breaks.',
        section('First', firstRun, firstSkill),
        section('Second', secondRun, secondSkill),
      ].join('\n\n')
    );
  }
  // Kept outside the packet folder so judges never see it.
  writeFileSync(mappingPath(dir), JSON.stringify(mapping, null, 2));
  writeFileSync(
    path.join(dir, 'INSTRUCTIONS.md'),
    INSTRUCTIONS({
      rubric: readFileSync(RUBRIC_PATH, 'utf8'),
      skills: [skills.A, skills.B],
      productGuide,
    })
  );
  return { dir, count: pairs.length };
}

/** Fold verdicts back into both run sets and render their reports. */
export function importVerdicts(dir: string) {
  const legacy = path.join(dir, 'mapping.json');
  const mapping = JSON.parse(
    readFileSync(existsSync(legacy) ? legacy : mappingPath(dir), 'utf8')
  ) as Mapping;
  const a = loadRunSet(mapping.setA);
  const b = loadRunSet(mapping.setB);
  const runsA = new Map(a.runs.map((run) => [runKey(run), run]));
  const runsB = new Map(b.runs.map((run) => [runKey(run), run]));
  const pairs: ComparePair[] = [];
  const missing: string[] = [];
  for (const key of Object.keys(mapping.pairs).sort()) {
    const file = path.join(dir, `${key}.json`);
    let verdict: PacketVerdict;
    try {
      verdict = JSON.parse(readFileSync(file, 'utf8')) as PacketVerdict;
    } catch {
      missing.push(key);
      continue;
    }
    const aIsFirst = mapping.pairs[key].first === 'A';
    const runA = runsA.get(key)!;
    const runB = runsB.get(key)!;
    runA.judgement = normalizeJudgement(
      (aIsFirst ? verdict.first : verdict.second) ?? {}
    );
    runB.judgement = normalizeJudgement(
      (aIsFirst ? verdict.second : verdict.first) ?? {}
    );
    writeRun(a.dir, runA);
    writeRun(b.dir, runB);
    const winner =
      verdict.winner === 'tie' || !verdict.winner
        ? 'tie'
        : (verdict.winner === 'first') === aIsFirst
          ? 'A'
          : 'B';
    pairs.push({
      persona: runA.persona.id,
      repeat: runA.repeat,
      a: runA,
      b: runB,
      verdict: { winner, why: verdict.why ?? '' },
    });
  }
  const setA = loadRunSet(a.dir);
  const setB = loadRunSet(b.dir);
  writeFileSync(
    path.join(a.dir, 'report.html'),
    renderRunSetReport(setA.manifest, setA.runs)
  );
  writeFileSync(
    path.join(b.dir, 'report.html'),
    renderRunSetReport(setB.manifest, setB.runs)
  );
  const reportPath = path.join(dir, 'compare.html');
  writeFileSync(reportPath, renderCompareReport({ a: setA, b: setB, pairs }));
  return {
    reportPath,
    pairs,
    missing,
    labels: [a.manifest.label, b.manifest.label],
  };
}

export function listPackets(dir: string) {
  return readdirSync(dir)
    .filter((name) => /\.\d+\.md$/.test(name))
    .sort()
    .map((name) => path.join(dir, name));
}
