import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { loadCheckpoint } from './checkpoint.js';
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

// Judging without a judge model: the lab writes one packet per persona run,
// holding that run from every set being compared. A Claude session (or its
// subagents) writes a verdict next to each packet, and `import` folds the
// verdicts back into the run sets and writes comparison reports against the
// first set, which acts as the control.

const LABELS = ['first', 'second', 'third', 'fourth'] as const;
type Label = (typeof LABELS)[number];

type Mapping = {
  /** Run-set folders; the first is the control. */
  sets: string[];
  /** For each packet, which set each label shows: order[labelIndex] = setIndex. */
  packets: Record<string, { order: number[] }>;
};

/** The two-set format written before three-way packets existed. */
type LegacyMapping = {
  setA: string;
  setB: string;
  pairs: Record<string, { first: 'A' | 'B' }>;
};

type PacketVerdict = Partial<Record<Label, Partial<Judgement>>> & {
  winner?: Label | 'tie';
  ranking?: Label[];
  why?: string;
};

const capitalize = (label: string) => label[0].toUpperCase() + label.slice(1);

const INSTRUCTIONS = (input: {
  count: number;
  rubric: string;
  skills: string[];
  productGuide: string;
}) => {
  const labels = LABELS.slice(0, input.count);
  const shown = labels.map((label) => `"${capitalize(label)}"`).join(', ');
  const verdictShape =
    input.count === 2
      ? `  "winner": "first" | "second" | "tie",`
      : `  "ranking": [${labels.map((label) => `"${label}"`).join(', ')}] in order from best to worst,`;
  return `# Judging packets

Each \`<persona>.<n>.md\` file in this folder holds ${input.count} conversations
with the same simulated person, labeled ${shown}. Their order is shuffled.
For each packet, write \`<persona>.<n>.json\` next to it:

\`\`\`json
{
${labels.map((label) => `  "${label}": { ...judgement for the ${label} conversation... },`).join('\n')}
${verdictShape}
  "why": "Two or three sentences quoting the decisive differences."
}
\`\`\`

Each judgement follows the Output section of the rubric below. ${
    input.count === 2
      ? 'Pick the winner by which conversation served this person better overall: the ending, the conversation, the first result, product answers, and the follow-up. Prefer "tie" only when they are genuinely equivalent.'
      : 'Rank the conversations by how well each served this person overall: the ending, the conversation, the first result, product answers, and the follow-up. Every packet needs a full ranking with no ties.'
  }

Rule breaks are judged against the skill each conversation ran, named in its
packet. Read a skill file when you need it. When the person asks about the app
itself, check the answers against the product guide at \`${input.productGuide}\`.

Skills in this batch:
${[...new Set(input.skills)].map((skill) => `- ${skill}`).join('\n')}

---

${input.rubric}
`;
};

function mappingPath(dir: string) {
  return `${dir.replace(/\/$/, '')}.mapping.json`;
}

function runKey(run: RunRecord) {
  return `${run.persona.id}.${run.repeat}`;
}

function skillPath(config: LabConfig, variant?: string) {
  return loadPromptSources(config, variant).skill.path;
}

function shuffle<T>(items: T[]) {
  for (let index = items.length - 1; index > 0; index--) {
    const swap = Math.floor(Math.random() * (index + 1));
    [items[index], items[swap]] = [items[swap], items[index]];
  }
  return items;
}

/** Every ordering of 0..n-1, used in equal numbers so position bias cancels. */
function permutations(n: number): number[][] {
  if (n === 1) return [[0]];
  return permutations(n - 1).flatMap((rest) =>
    Array.from({ length: n }, (_, at) => [
      ...rest.slice(0, at),
      n - 1,
      ...rest.slice(at),
    ])
  );
}

/**
 * Write one packet per persona run that every set completed. The first set is
 * the control that the others are compared against.
 */
export function writePackets(config: LabConfig, dirs: string[]) {
  if (dirs.length < 2 || dirs.length > LABELS.length) {
    throw new Error(`packets needs 2 to ${LABELS.length} run sets`);
  }
  const sets = dirs.map((dir) => loadRunSet(dir));
  const checkpoints = sets.map((set) => loadCheckpoint(set.dir, set.manifest));
  const byKey = sets.map(
    (set) => new Map(set.runs.map((run) => [runKey(run), run]))
  );
  const keys = sets[0].runs
    .map(runKey)
    .filter((key) =>
      byKey.every((runs) => runs.has(key) && !runs.get(key)!.error)
    );
  if (!keys.length) throw new Error('The run sets share no completed runs.');

  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\..+$/, '')
    .replace('T', '-');
  const dir = path.join(
    RUNS_DIR,
    `judging-${stamp}-${sets.map((set) => set.manifest.label).join('-vs-')}`.replace(
      /[^a-z0-9.-]+/gi,
      '-'
    )
  );
  mkdirSync(path.join(dir, 'skills'), { recursive: true });
  // Judges need each conversation's skill to check rule breaks, but a file
  // path like variants/<name>/SKILL.md would reveal which side is which.
  const skillNumbers = shuffle(sets.map((_, index) => index + 1));
  const skills = sets.map((set, index) => {
    const file = path.join(dir, 'skills', `skill-${skillNumbers[index]}.md`);
    const frozen = checkpoints[index];
    if (frozen) writeFileSync(file, frozen.sources.skill.text);
    else copyFileSync(skillPath(config, set.manifest.variant), file);
    return file;
  });
  const productGuide = path.join(dir, 'skills', 'product-guide.md');
  const frozenGuide = checkpoints[0]?.sources.skills.find((skill) => skill.dir === PRODUCT_GUIDE_DIR);
  if (frozenGuide) writeFileSync(productGuide, frozenGuide.text);
  else copyFileSync(loadPromptSources(config).skills.find((skill) => skill.dir === PRODUCT_GUIDE_DIR)!.path, productGuide);

  const orders = permutations(sets.length);
  const assigned = shuffle(
    keys.map((_, index) => orders[index % orders.length])
  );
  const searchOff = sets.some((set) => set.manifest.search === false);
  const mapping: Mapping = { sets: sets.map((set) => set.dir), packets: {} };
  for (const [index, key] of keys.entries()) {
    const order = assigned[index];
    mapping.packets[key] = { order };
    const runs = order.map((setIndex) => byKey[setIndex].get(key)!);
    writeFileSync(
      path.join(dir, `${key}.md`),
      [
        `# ${key}`,
        '## Persona card',
        stringify(runs[0].persona),
        '## Deployment facts',
        `The bot runs on \`${runs[0].models.bot}\` through OpenRouter. This is a real model, possibly newer than your training data; the bot naming it is not a hallucination. Today is ${new Date(runs[0].startedAt).toDateString()}.`,
        ...(searchOff
          ? [
              'Web search was unavailable to the bot in this round (a quota outage), in every conversation. Do not penalize a result for lacking current information; judge how the bot handled not having it.',
            ]
          : []),
        'Messages marked (coordinator) come from fixed product code, not the bot model. Judge the flow they create, but do not count their wording as the bot’s choices or rule breaks.',
        ...order.map((setIndex, labelIndex) =>
          [
            `## ${capitalize(LABELS[labelIndex])} conversation`,
            `Skill: ${skills[setIndex]}`,
            '### Measured facts',
            JSON.stringify(runs[labelIndex].facts, null, 2),
            '### What happened',
            renderForJudge(runs[labelIndex]),
          ].join('\n\n')
        ),
      ].join('\n\n')
    );
  }
  // Kept outside the packet folder so judges never see it.
  writeFileSync(mappingPath(dir), JSON.stringify(mapping, null, 2));
  writeFileSync(
    path.join(dir, 'INSTRUCTIONS.md'),
    INSTRUCTIONS({
      count: sets.length,
      rubric: checkpoints[0]?.rubric ?? readFileSync(RUBRIC_PATH, 'utf8'),
      skills,
      productGuide,
    })
  );
  return { dir, count: keys.length };
}

function readMapping(dir: string): Mapping {
  const legacyFile = path.join(dir, 'mapping.json');
  const raw = JSON.parse(
    readFileSync(existsSync(legacyFile) ? legacyFile : mappingPath(dir), 'utf8')
  ) as Mapping | LegacyMapping;
  if ('sets' in raw) return raw;
  return {
    sets: [raw.setA, raw.setB],
    packets: Object.fromEntries(
      Object.entries(raw.pairs).map(([key, { first }]) => [
        key,
        { order: first === 'A' ? [0, 1] : [1, 0] },
      ])
    ),
  };
}

/**
 * Fold verdicts into every run set and write one comparison report per
 * non-control set, each against the control.
 */
export function importVerdicts(dir: string) {
  const mapping = readMapping(dir);
  const sets = mapping.sets.map((setDir) => loadRunSet(setDir));
  const byKey = sets.map(
    (set) => new Map(set.runs.map((run) => [runKey(run), run]))
  );
  const missing: string[] = [];
  /** rank[setIndex][key] = 0 for best. */
  const ranks = sets.map(() => new Map<string, number>());
  const why = new Map<string, string>();
  const ties = new Set<string>();

  for (const [key, { order }] of Object.entries(mapping.packets)) {
    let verdict: PacketVerdict;
    try {
      verdict = JSON.parse(
        readFileSync(path.join(dir, `${key}.json`), 'utf8')
      ) as PacketVerdict;
    } catch {
      missing.push(key);
      continue;
    }
    why.set(key, verdict.why ?? '');
    order.forEach((setIndex, labelIndex) => {
      const run = byKey[setIndex].get(key)!;
      run.judgement = normalizeJudgement(verdict[LABELS[labelIndex]] ?? {});
      writeRun(sets[setIndex].dir, run);
    });
    const ranking: Label[] =
      verdict.ranking ??
      (verdict.winner === 'second' ? ['second', 'first'] : ['first', 'second']);
    if (!verdict.ranking && (verdict.winner === 'tie' || !verdict.winner)) {
      ties.add(key);
    }
    ranking.forEach((label, position) => {
      const labelIndex = LABELS.indexOf(label);
      if (labelIndex >= 0 && labelIndex < order.length) {
        ranks[order[labelIndex]].set(key, position);
      }
    });
  }

  const reloaded = sets.map((set) => loadRunSet(set.dir));
  for (const set of reloaded) {
    writeFileSync(
      path.join(set.dir, 'report.html'),
      renderRunSetReport(set.manifest, set.runs)
    );
  }
  const reloadedByKey = reloaded.map(
    (set) => new Map(set.runs.map((run) => [runKey(run), run]))
  );
  const comparisons = reloaded.slice(1).map((set, offset) => {
    const setIndex = offset + 1;
    const pairs: ComparePair[] = [];
    for (const key of Object.keys(mapping.packets).sort()) {
      const control = ranks[0].get(key);
      const other = ranks[setIndex].get(key);
      if (control === undefined || other === undefined) continue;
      const a = reloadedByKey[0].get(key)!;
      const b = reloadedByKey[setIndex].get(key)!;
      pairs.push({
        persona: a.persona.id,
        repeat: a.repeat,
        a,
        b,
        verdict: {
          winner: ties.has(key) ? 'tie' : other < control ? 'B' : 'A',
          why: why.get(key) ?? '',
        },
      });
    }
    const reportPath = path.join(
      dir,
      `compare-${reloaded[0].manifest.label}-vs-${set.manifest.label}.html`.replace(
        /[^a-z0-9.-]+/gi,
        '-'
      )
    );
    writeFileSync(
      reportPath,
      renderCompareReport({ a: reloaded[0], b: set, pairs })
    );
    return { label: set.manifest.label, reportPath, pairs };
  });
  const averageRank = reloaded.map((set, setIndex) => {
    const values = [...ranks[setIndex].values()];
    return {
      label: set.manifest.label,
      averageRank: values.length
        ? values.reduce((sum, value) => sum + value + 1, 0) / values.length
        : null,
      firstPlaces: values.filter((value) => value === 0).length,
    };
  });
  return {
    control: reloaded[0].manifest.label,
    comparisons,
    averageRank,
    missing,
  };
}

export function listPackets(dir: string) {
  return readdirSync(dir)
    .filter((name) => /\.\d+\.md$/.test(name))
    .sort()
    .map((name) => path.join(dir, name));
}
