import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, RUNS_DIR, loadConfig, sha256 } from './config.js';
import { chatJson } from './openrouter.js';
import { loadRunSet } from './store.js';
import {
  EDITABLE_FILES,
  VARIANTS_DIR,
  effectiveText,
  listVariants,
  parentOf,
} from './workbench.js';

// What each variant changes relative to its parent, as line counts, a compact
// diff, and a short model-written description cached in the variant folder.

type FileChange = {
  file: string;
  added: number;
  removed: number;
  diff: string;
};

export type Changeset = {
  name: string;
  parent: string;
  files: FileChange[];
  hash: string;
};

export type Description = {
  hash: string;
  title: string;
  bullets: string[];
  describedAt: string;
};

/** A unified-style diff with two lines of context around each change. */
function compactDiff(before: string, after: string) {
  const a = before.split('\n');
  const b = after.split('\n');
  const n = a.length;
  const m = b.length;
  const table = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i][j] =
        a[i] === b[j]
          ? table[i + 1][j + 1] + 1
          : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const lines: [' ' | '+' | '-', string][] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      lines.push([' ', a[i++]]);
      j++;
    } else if (table[i + 1][j] >= table[i][j + 1]) lines.push(['-', a[i++]]);
    else lines.push(['+', b[j++]]);
  }
  while (i < n) lines.push(['-', a[i++]]);
  while (j < m) lines.push(['+', b[j++]]);
  const keep = new Set<number>();
  lines.forEach(([kind], index) => {
    if (kind !== ' ') for (let k = index - 2; k <= index + 2; k++) keep.add(k);
  });
  const out: string[] = [];
  let skipped = false;
  lines.forEach(([kind, text], index) => {
    if (!keep.has(index)) {
      skipped = true;
      return;
    }
    if (skipped) out.push('…');
    skipped = false;
    out.push(`${kind} ${text}`);
  });
  return {
    diff: out.join('\n'),
    added: lines.filter(([kind]) => kind === '+').length,
    removed: lines.filter(([kind]) => kind === '-').length,
  };
}

/** Every file whose effective text differs between a variant and its parent. */
export function changeset(name: string): Changeset {
  if (
    !listVariants().some(
      (variant) => variant.name === name && !variant.readOnly
    )
  ) {
    throw new Error(`No variant named ${name}`);
  }
  const parent = parentOf(name);
  const files = EDITABLE_FILES.flatMap((file) => {
    const before = effectiveText(parent, file);
    const after = effectiveText(name, file);
    return before === after ? [] : [{ file, ...compactDiff(before, after) }];
  });
  return {
    name,
    parent,
    files,
    hash: sha256(JSON.stringify([parent, files.map((f) => [f.file, f.diff])])),
  };
}

function descriptionFile(name: string) {
  return path.join(VARIANTS_DIR, name, '.description.json');
}

function cachedDescription(name: string, hash: string) {
  const file = descriptionFile(name);
  if (!existsSync(file)) return undefined;
  const cached = JSON.parse(readFileSync(file, 'utf8')) as Description;
  return cached.hash === hash ? cached : undefined;
}

const DESCRIBE_PROMPT = `You are summarizing one experiment in a prompt lab for an onboarding chatbot (Tlonbot, in the Tlon Messenger app). Below is the diff between a variant and the variant it was based on. Files: SKILL.md is the onboarding skill the bot follows; coordinator.yaml holds fixed app messages (welcome, post-setup offer); tips.yaml holds first-week tip copy; other .md files are workspace prompts.

Describe what the variant changes about the bot's behavior or what users see, not the mechanics of the edit. Plain words, no jargon, no line numbers. Lead with the most important change.

Return only JSON: {"title": "<at most 8 words>", "bullets": ["<one short sentence>", ...]} with 1 to 4 bullets.`;

/** The cached description, or a new one if the changeset moved since. */
export async function describeVariant(name: string, force = false) {
  const change = changeset(name);
  if (!change.files.length) {
    return {
      hash: change.hash,
      title: 'Same as its parent',
      bullets: [],
      describedAt: new Date().toISOString(),
    } satisfies Description;
  }
  const cached = force ? undefined : cachedDescription(name, change.hash);
  if (cached) return cached;
  const diff = change.files
    .map((file) => `### ${file.file}\n${file.diff}`)
    .join('\n\n')
    .slice(0, 16_000);
  const config = loadConfig({}, { search: false });
  const reply = await chatJson<{ title?: string; bullets?: string[] }>({
    key: config.openrouterKey,
    model: config.models.bot,
    maxTokens: 2000,
    meter: { usd: 0 },
    messages: [
      { role: 'system', content: DESCRIBE_PROMPT },
      {
        role: 'user',
        content: `Variant "${name}", based on "${change.parent}":\n\n${diff}`,
      },
    ],
  });
  const description: Description = {
    hash: change.hash,
    title: String(reply.title ?? 'Changes').slice(0, 80),
    bullets: (Array.isArray(reply.bullets) ? reply.bullets : [])
      .map(String)
      .slice(0, 4),
    describedAt: new Date().toISOString(),
  };
  writeFileSync(
    descriptionFile(name),
    `${JSON.stringify(description, null, 2)}\n`
  );
  return description;
}

/** Run sets per variant, newest first, for the list. */
function runSetsByVariant() {
  const byVariant = new Map<
    string,
    { name: string; createdAt: string; sources: Map<string, string> }[]
  >();
  if (!existsSync(RUNS_DIR)) return byVariant;
  for (const name of readdirSync(RUNS_DIR)) {
    const manifestFile = path.join(RUNS_DIR, name, 'manifest.json');
    if (!existsSync(manifestFile)) continue;
    const manifest = loadRunSet(path.join(RUNS_DIR, name)).manifest;
    const variant = manifest.variant
      ? path.basename(manifest.variant)
      : 'baseline';
    const list = byVariant.get(variant) ?? [];
    list.push({
      name,
      createdAt: manifest.createdAt,
      sources: new Map(
        manifest.sources.map((source) => [
          path.resolve(REPO_ROOT, source.path),
          source.sha256,
        ])
      ),
    });
    byVariant.set(variant, list);
  }
  for (const list of byVariant.values()) {
    list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  return byVariant;
}

/** Everything the variants list shows, without calling a model. */
export function variantOverview() {
  const runs = runSetsByVariant();
  return listVariants()
    .filter((variant) => !variant.readOnly)
    .map((variant) => {
      const change = changeset(variant.name);
      const dir = path.join(VARIANTS_DIR, variant.name);
      const modifiedAt = Math.max(
        // The folder's own time moves when descriptions are cached; only the
        // variant's files say when it last changed.
        0,
        ...EDITABLE_FILES.map((file) => path.join(dir, file))
          .filter((file) => existsSync(file))
          .map((file) => statSync(file).mtimeMs)
      );
      const description = change.files.length
        ? cachedDescription(variant.name, change.hash)
        : { title: 'Same as its parent', bullets: [] };
      return {
        name: variant.name,
        parent: change.parent,
        modifiedAt: new Date(modifiedAt).toISOString(),
        files: change.files.map(({ file, added, removed }) => ({
          file,
          added,
          removed,
        })),
        description: description ?? null,
        runSets: (runs.get(variant.name) ?? []).map(({ name, createdAt }) => ({
          name,
          createdAt,
        })),
        editedSinceLastRun: (() => {
          const last = runs.get(variant.name)?.[0];
          if (!last) return false;
          return variant.files.some((file) => {
            const full = path.join(dir, file);
            return (
              last.sources.get(full) !== sha256(readFileSync(full, 'utf8'))
            );
          });
        })(),
      };
    })
    .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
}
