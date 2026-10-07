#!/usr/bin/env node
// Keeps the product guide's feature map honest against the app's source.
//
//   check    every entry's quoted labels exist in the files it cites, its
//            "absent" terms appear nowhere, and every screen, message action,
//            feature flag and slash command is covered or explicitly skipped
//   labels   loose check for a Markdown file without anchors: each quoted
//            label must appear somewhere in the app's source
//   surface  print the inventory the coverage check uses
//   affected list the entries citing files that changed, for a re-read: the
//            check cannot see behaviour that changes behind the same labels
//   promote  write the copy bots read: only what is true for the given release
//
// See docs/feature-map/README.md for the entry format.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const MAP_DIR = 'docs/feature-map';
export const SKILL_DIR = 'packages/openclaw/skills/tlon-product-guide';
export const PUBLISHED_DIR = `${SKILL_DIR}/references`;
const IGNORE_FILE = `${MAP_DIR}/surface-ignore.txt`;
const QUESTIONS_DIR = `${MAP_DIR}/questions`;
// What each published entry rested on. Kept out of the skill's folder: it is
// for `promote`, not for bots, and it is nearly as large as the references.
const ANCHORS_FILE = `${MAP_DIR}/release-anchors.json`;
const INDEX_START = '<!-- feature-map:index:start -->';
const INDEX_END = '<!-- feature-map:index:end -->';

// Where user-visible text can come from. Used for "absent" terms and for the
// loose `labels` check; entries themselves cite exact files.
const SOURCE_ROOTS = [
  'packages/app',
  'packages/ui/src',
  'packages/shared/src',
  'packages/api/src',
  'packages/editor/src',
  'apps/tlon-mobile/src',
  'apps/tlon-mobile/modules',
  'apps/tlon-web/src',
  'apps/tlon-desktop/src',
  'packages/openclaw/src',
];

const SURFACE_SOURCES = {
  route: 'packages/app/navigation/types.ts',
  action: 'packages/api/src/types/ChannelActions.ts',
  flag: 'packages/app/lib/featureFlags.ts',
  command: 'packages/openclaw/src/commands-registry.ts',
};

// --- parsing ---------------------------------------------------------------

export function slugify(heading) {
  return heading
    .toLowerCase()
    .replace(/[`'’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const ANCHOR_RE = /<!--\s*(src|covers|absent|flag)\s*:([\s\S]*?)-->/g;

function splitList(value) {
  return value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function stripAnchors(text) {
  return text.replace(ANCHOR_RE, '').replace(/\n{3,}/g, '\n\n');
}

/** Inline code spans outside fenced blocks: the map's quoted labels. */
export function extractLabels(body) {
  const prose = stripAnchors(body).replace(/```[\s\S]*?```/g, '');
  const labels = new Set();
  for (const match of prose.matchAll(/`([^`\n]+)`/g)) {
    labels.add(match[1].trim());
  }
  return [...labels];
}

/**
 * A map file is a title, an optional intro, then one entry per `## ` heading.
 * Anchors are HTML comments anywhere inside the entry.
 */
export function parseMapFile(text, file = '') {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  let title = '';
  const intro = [];
  const entries = [];
  let current = null;
  let inFence = false;
  for (const line of lines) {
    if (line.startsWith('```')) inFence = !inFence;
    if (!inFence && line.startsWith('## ')) {
      current = { heading: line.slice(3).trim(), lines: [] };
      entries.push(current);
    } else if (!inFence && !title && line.startsWith('# ')) {
      title = line.slice(2).trim();
    } else if (current) {
      current.lines.push(line);
    } else {
      intro.push(line);
    }
  }
  return {
    file,
    title,
    intro: intro.join('\n').trim(),
    entries: entries.map(({ heading, lines: bodyLines }) => {
      const raw = bodyLines.join('\n');
      const anchors = { src: [], covers: [], absent: [], flag: [] };
      for (const match of raw.matchAll(ANCHOR_RE)) {
        anchors[match[1]].push(...splitList(match[2]));
      }
      return {
        heading,
        slug: slugify(heading),
        raw,
        body: stripAnchors(raw).trim(),
        labels: extractLabels(raw),
        ...anchors,
      };
    }),
  };
}

// --- matching --------------------------------------------------------------

/**
 * Source and label are compared after the same clean-up, so a label split
 * across JSX lines or written with an escaped apostrophe still matches.
 */
export function normalize(text) {
  return text
    .replace(/&apos;|&#39;|&rsquo;|\\'|’/g, "'")
    .replace(/&quot;|\\"|[“”]/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\{' '\}/g, ' ')
    .replace(/\s+/g, ' ');
}

/** `/ban <request-id>` is checked as the command name `ban`. */
function needleFor(label) {
  if (label.startsWith('/')) return label.slice(1).split(/\s+/)[0];
  return label;
}

const WORD = /[\p{L}\p{N}]/u;

/** `Pin` must not pass on the strength of `Pinned`: whole words only. */
function includesWhole(source, needle) {
  const edgeStart = WORD.test(needle[0]);
  const edgeEnd = WORD.test(needle.at(-1));
  for (
    let at = source.indexOf(needle);
    at !== -1;
    at = source.indexOf(needle, at + 1)
  ) {
    const before = source[at - 1];
    const after = source[at + needle.length];
    if (edgeStart && before !== undefined && WORD.test(before)) continue;
    if (edgeEnd && after !== undefined && WORD.test(after)) continue;
    return true;
  }
  return false;
}

export function labelInSources(label, sources) {
  const needle = normalize(needleFor(label));
  return (
    needle !== '' && sources.some((source) => includesWhole(source, needle))
  );
}

// --- file access (working tree, or any git ref) ----------------------------

export function makeReader(root, ref) {
  const cache = new Map();
  const git = (args) =>
    execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  return {
    ref,
    read(file) {
      if (cache.has(file)) return cache.get(file);
      let text = null;
      try {
        text = ref
          ? git(['show', `${ref}:${file}`])
          : fs.readFileSync(path.join(root, file), 'utf8');
      } catch {
        text = null;
      }
      cache.set(file, text);
      return text;
    },
    /** Files under the source roots that contain `term`, ignoring case. */
    grep(term) {
      const args = ['grep', '-l', '-i', '-F', '-e', term];
      if (ref) args.push(ref);
      args.push('--', ...SOURCE_ROOTS, ':!*.test.*', ':!*.fixture.*');
      try {
        return git(args)
          .split('\n')
          .filter(Boolean)
          .map((line) => (ref ? line.slice(ref.length + 1) : line));
      } catch {
        return []; // git grep exits 1 when nothing matches
      }
    },
    list(dir) {
      try {
        return ref
          ? git(['ls-tree', '--name-only', `${ref}:${dir}`])
              .split('\n')
              .filter(Boolean)
          : fs.readdirSync(path.join(root, dir));
      } catch {
        return [];
      }
    },
  };
}

// --- surface inventory -----------------------------------------------------

/** Keys one level inside every `export type …ParamList = {` block. */
function routeNames(text) {
  const names = new Set();
  let depth = 0;
  let inList = false;
  for (const line of text.split('\n')) {
    // A declaration runs to its closing `;`, so a list written as
    // `Pick<…> & {` with the brace on a later line is still read.
    if (depth === 0 && /^export type \w+ParamList\b/.test(line)) inList = true;
    if (inList && depth === 1) {
      const key = /^\s+([A-Z]\w+)\??:/.exec(line);
      if (key) names.add(key[1]);
    }
    for (const char of line) {
      if (char === '{') depth += 1;
      if (char === '}') depth -= 1;
    }
    if (depth === 0 && /;\s*$/.test(line)) inList = false;
  }
  return [...names];
}

function actionIds(text) {
  const union = /export type Id =([\s\S]*?);/.exec(text);
  return union ? [...union[1].matchAll(/'(\w+)'/g)].map((m) => m[1]) : [];
}

function flagNames(text) {
  const meta = /export const featureMeta = \{([\s\S]*?)\n\} satisfies/.exec(
    text
  );
  return meta ? [...meta[1].matchAll(/^ {2}(\w+): \{/gm)].map((m) => m[1]) : [];
}

function commandNames(text) {
  const names = [...text.matchAll(/^\s+name: '([\w-]+)',/gm)].map((m) => m[1]);
  const core = /CORE_COMMAND_TOKENS = \[([^\]]*)\]/.exec(text);
  if (core) {
    names.push(...[...core[1].matchAll(/'\/([\w-]+)'/g)].map((m) => m[1]));
  }
  return names;
}

export function readSurface(reader) {
  const extractors = {
    route: routeNames,
    action: actionIds,
    flag: flagNames,
    command: commandNames,
  };
  const items = [];
  const missingSources = [];
  for (const [kind, file] of Object.entries(SURFACE_SOURCES)) {
    const text = reader.read(file);
    if (text === null) {
      missingSources.push(file);
      continue;
    }
    const names = extractors[kind](text);
    if (!names.length) missingSources.push(file);
    items.push(...names.map((name) => `${kind}:${name}`));
  }
  return { items: [...new Set(items)].sort(), missingSources };
}

function readIgnored(reader) {
  const text = reader.read(IGNORE_FILE) ?? '';
  return text
    .split('\n')
    .map((line) => line.replace(/#.*$/, '').trim())
    .filter(Boolean);
}

// --- checks ----------------------------------------------------------------

/**
 * The `file:` and `entry:` of each question in a questions file. Read line by
 * line so this script needs no YAML parser: a question starts at `- id:`, and
 * its fields sit one per line beneath it.
 */
export function questionAnchors(text) {
  const scalar = (value) => {
    const trimmed = value.replace(/\s+#.*$/, '').trim();
    if (/^'.*'$/.test(trimmed)) return trimmed.slice(1, -1).replace(/''/g, "'");
    if (/^".*"$/.test(trimmed)) return JSON.parse(trimmed);
    return trimmed;
  };
  const questions = [];
  for (const line of text.split('\n')) {
    const id = /^- id:(.*)$/.exec(line);
    if (id) questions.push({ id: scalar(id[1]) });
    const field = /^ {2}(file|entry):(.*)$/.exec(line);
    if (field && questions.length)
      questions.at(-1)[field[1]] = scalar(field[2]);
  }
  return questions;
}

/** Questions that point at a map file or entry heading that is not there. */
export function checkQuestions(reader, files) {
  const failures = [];
  for (const name of reader
    .list(QUESTIONS_DIR)
    .filter((n) => n.endsWith('.yaml'))) {
    const text = reader.read(`${QUESTIONS_DIR}/${name}`) ?? '';
    for (const { id, file, entry } of questionAnchors(text)) {
      if (!file && !entry) continue;
      const mapFile = files.find((candidate) => candidate.file === file);
      if (!mapFile?.entries.some((candidate) => candidate.heading === entry)) {
        failures.push({
          file: `questions/${name}`,
          entry: id,
          problem: `no entry "${entry}" in ${file}`,
        });
      }
    }
  }
  return failures;
}

export function readMap(reader) {
  return reader
    .list(MAP_DIR)
    .filter((name) => name.endsWith('.md') && name !== 'README.md')
    .sort()
    .map((name) => parseMapFile(reader.read(`${MAP_DIR}/${name}`) ?? '', name));
}

/**
 * The copy bots read. Its text carries no anchors, so each entry's `src` comes
 * from ANCHORS_FILE.
 */
function readPublished(reader) {
  const anchors = JSON.parse(reader.read(ANCHORS_FILE) ?? '{}');
  return reader
    .list(PUBLISHED_DIR)
    .filter((name) => name.endsWith('.md'))
    .sort()
    .map((name) => {
      const file = parseMapFile(
        reader.read(`${PUBLISHED_DIR}/${name}`) ?? '',
        name
      );
      for (const entry of file.entries) {
        entry.src = anchors[`${name}#${entry.slug}`]?.src ?? [];
      }
      return file;
    });
}

/** Problems that make one entry wrong for the code the reader points at. */
export function checkEntry(entry, reader) {
  const problems = [];
  if (!entry.src.length && !entry.absent.length) {
    problems.push('no `src:` or `absent:` anchor');
  }
  const sources = [];
  for (const file of entry.src) {
    const text = reader.read(file);
    if (text === null) problems.push(`cited file is missing: ${file}`);
    else sources.push(normalize(text));
  }
  if (sources.length) {
    for (const label of entry.labels) {
      if (!labelInSources(label, sources)) {
        problems.push(`label not in cited files: \`${label}\``);
      }
    }
  } else if (entry.labels.length && !entry.src.length) {
    problems.push('quotes labels but cites no files');
  }
  for (const term of entry.absent) {
    const hits = reader.grep(term);
    if (hits.length) {
      problems.push(
        `says the app has no "${term}", but it appears in ${hits.slice(0, 3).join(', ')}`
      );
    }
  }
  return problems;
}

export function checkMap(reader) {
  const files = readMap(reader);
  const failures = [];
  const slugs = new Map();
  const covered = new Set();
  const surface = readSurface(reader);
  const flags = surface.items
    .filter((item) => item.startsWith('flag:'))
    .map((item) => item.slice(5));
  for (const file of files) {
    if (!file.title)
      failures.push({ file: file.file, problem: 'no `# ` title' });
    for (const entry of file.entries) {
      const where = { file: file.file, entry: entry.heading };
      const key = `${file.file}#${entry.slug}`;
      if (slugs.has(key))
        failures.push({ ...where, problem: 'duplicate heading' });
      slugs.set(key, true);
      for (const problem of checkEntry(entry, reader)) {
        failures.push({ ...where, problem });
      }
      for (const item of entry.covers) {
        covered.add(item);
        if (!surface.items.includes(item)) {
          failures.push({
            ...where,
            problem: `covers ${item}, which is not in the code`,
          });
        }
      }
      for (const flag of entry.flag) {
        if (!flags.includes(flag)) {
          failures.push({
            ...where,
            problem: `names flag ${flag}, which is not in the code`,
          });
        }
      }
    }
  }
  failures.push(...checkQuestions(reader, files));
  const ignored = readIgnored(reader);
  for (const file of surface.missingSources) {
    failures.push({
      file,
      problem: 'could not read the surface inventory from this file',
    });
  }
  for (const item of ignored) {
    if (!surface.items.includes(item)) {
      failures.push({
        file: IGNORE_FILE,
        problem: `skips ${item}, which is not in the code`,
      });
    }
  }
  const unmapped = surface.items.filter(
    (item) => !covered.has(item) && !ignored.includes(item)
  );
  for (const item of unmapped) {
    failures.push({
      file: SURFACE_SOURCES[item.split(':')[0]],
      problem: `${item} is not covered by any entry (add \`covers: ${item}\` to one, or list it in ${IGNORE_FILE} with a reason)`,
    });
  }
  const entryCount = files.reduce((sum, file) => sum + file.entries.length, 0);
  return { files, failures, surface, covered, ignored, entryCount };
}

/** Quoted labels in any Markdown file that appear nowhere in the source. */
export function checkLooseLabels(text, reader) {
  // The index is generated from the map, which has its own, stricter check.
  const start = text.indexOf(INDEX_START);
  const end = text.indexOf(INDEX_END);
  const prose =
    start !== -1 && end > start ? text.slice(0, start) + text.slice(end) : text;
  const skip = /^(https?:|~|[a-z-]+\/~)|[<>|]|^tlon\b/;
  return extractLabels(prose)
    .filter((label) => !skip.test(label))
    .filter((label) => reader.grep(needleFor(label)).length === 0);
}

// --- promote ---------------------------------------------------------------

function renderPublished(file, entries) {
  const parts = [`# ${file.title}`];
  if (file.intro) parts.push(file.intro);
  for (const entry of entries)
    parts.push(`## ${entry.heading}\n\n${entry.body}`);
  return `${parts.join('\n\n')}\n`;
}

function renderIndex(published) {
  const lines = [];
  for (const { name, file, entries } of published) {
    const scope = file.intro.split('\n')[0];
    lines.push(`- \`references/${name}\`: ${scope}`);
    lines.push(`  ${entries.map((entry) => entry.heading).join(' · ')}`);
  }
  return lines.join('\n');
}

export function replaceIndex(skillText, index) {
  const start = skillText.indexOf(INDEX_START);
  const end = skillText.indexOf(INDEX_END);
  if (start === -1 || end === -1 || end < start) return null;
  return `${skillText.slice(0, start + INDEX_START.length)}\n${index}\n${skillText.slice(end)}`;
}

/** What stops an entry, or the anchors saved with a published one, being true for a release. */
function releaseProblems(anchors, release, flagsOn) {
  const problems = checkEntry({ absent: [], ...anchors }, release);
  const flagOff = (anchors.flag ?? []).find((flag) => !flagsOn.has(flag));
  if (flagOff) problems.push(`flag ${flagOff} is off in this release`);
  return problems;
}

const anchorsOf = ({ src, labels, absent, flag }) => ({
  src,
  labels,
  absent,
  flag,
});

/**
 * Decide what bots should read for one release.
 *
 * - An entry in the map that is true for the release is published as written.
 * - One that is not (its labels arrived after the release, or its flag is off
 *   there) falls back to the copy published before, but only if that copy is
 *   itself true for this release. Otherwise it is left out.
 * - An entry published before that the map no longer has is kept when the
 *   release still has what it describes and `current`, the code the map
 *   follows, does not: a feature removed on develop is still in people's
 *   hands until a store build drops it. If `current` still has it, the entry
 *   left the map for another reason (renamed, merged, wrong) and its old copy
 *   goes with it.
 * - `drop` names entries (`file.md#slug`) to leave out regardless.
 *
 * `previous.anchors` holds, for each published entry, the files and labels it
 * rested on, which is what lets an old copy be tested against a release.
 */
export function planRelease({
  mapFiles,
  previous,
  release,
  current,
  flagsOn,
  drop = [],
}) {
  const held = [];
  const carried = [];
  const published = [];
  const names = [
    ...mapFiles.map((file) => file.file),
    ...Object.keys(previous.files).filter(
      (name) => !mapFiles.some((file) => file.file === name)
    ),
  ];
  const known = new Set(
    [...mapFiles, ...Object.values(previous.files)].flatMap((file) =>
      file.entries.map((entry) => `${file.file}#${entry.slug}`)
    )
  );
  const unknown = drop.filter((key) => !known.has(key));
  if (unknown.length) {
    throw new Error(`--drop names no entry: ${unknown.join(', ')}`);
  }
  for (const name of names) {
    const mapFile = mapFiles.find((file) => file.file === name);
    const oldFile = previous.files[name];
    const usableOld = (slug) => {
      const key = `${name}#${slug}`;
      const old = oldFile?.entries.find((entry) => entry.slug === slug);
      const anchors = previous.anchors[key];
      if (!old || !anchors || drop.includes(key)) return undefined;
      if (releaseProblems(anchors, release, flagsOn).length) return undefined;
      return { heading: old.heading, slug, body: old.body, anchors };
    };
    const entries = [];
    const inMap = new Set();
    for (const entry of mapFile?.entries ?? []) {
      inMap.add(entry.slug);
      if (drop.includes(`${name}#${entry.slug}`)) {
        held.push({
          file: name,
          entry: entry.heading,
          kept: 'left out',
          why: ['dropped with --drop'],
        });
        continue;
      }
      const problems = releaseProblems(entry, release, flagsOn);
      if (!problems.length) {
        entries.push({ ...entry, anchors: anchorsOf(entry) });
        continue;
      }
      const fallback = usableOld(entry.slug);
      if (fallback) entries.push(fallback);
      held.push({
        file: name,
        entry: entry.heading,
        kept: fallback ? 'previous published copy' : 'left out',
        why: problems,
      });
    }
    for (const old of oldFile?.entries ?? []) {
      if (inMap.has(old.slug)) continue;
      const kept = usableOld(old.slug);
      if (!kept) continue;
      // Still true for the code the map follows, so the feature is not gone:
      // the entry was renamed, merged into another, or deleted as wrong.
      const gone = checkEntry({ absent: [], ...kept.anchors }, current).length;
      if (!gone) continue;
      entries.push(kept);
      carried.push({ file: name, entry: old.heading });
    }
    if (entries.length) {
      const { title, intro } = mapFile ?? oldFile;
      published.push({ name, file: { title, intro }, entries });
    }
  }
  return { published, held, carried };
}

/** Run `planRelease` for the working tree's map and write the result. */
export function promote(root, app, drop = []) {
  // Everything that can fail is settled before the published copy is touched:
  // a mistyped tag reads as a release with no files in it, and would otherwise
  // empty the folder.
  let appCommit;
  try {
    appCommit = execFileSync(
      'git',
      ['rev-parse', '--verify', '--quiet', `${app}^{commit}`],
      { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    ).trim();
  } catch {
    throw new Error(`no such release in this checkout: ${app}`);
  }
  const head = makeReader(root);
  const release = makeReader(root, app);
  const flagsOn = new Set(
    [
      ...(release.read(SURFACE_SOURCES.flag) ?? '').matchAll(
        /^ {2}(\w+): \{\s*default: true/gm
      ),
    ].map((m) => m[1])
  );
  const previous = {
    files: Object.fromEntries(
      readPublished(head).map((file) => [file.file, file])
    ),
    anchors: JSON.parse(head.read(ANCHORS_FILE) ?? '{}'),
  };
  const { published, held, carried } = planRelease({
    mapFiles: readMap(head),
    previous,
    release,
    current: head,
    flagsOn,
    drop,
  });
  const skillPath = path.join(root, SKILL_DIR, 'SKILL.md');
  const skill = replaceIndex(
    fs.readFileSync(skillPath, 'utf8'),
    renderIndex(published)
  );
  if (skill === null) {
    throw new Error(
      `${SKILL_DIR}/SKILL.md has lost its index markers (${INDEX_START} … ${INDEX_END}), ` +
        'so bots could not find what was published'
    );
  }

  const outDir = path.join(root, PUBLISHED_DIR);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const anchors = {};
  for (const { name, file, entries } of published) {
    fs.writeFileSync(path.join(outDir, name), renderPublished(file, entries));
    for (const entry of entries)
      anchors[`${name}#${entry.slug}`] = entry.anchors;
  }
  const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
  fs.writeFileSync(
    path.join(outDir, 'RELEASE.json'),
    json({
      note: 'Generated by scripts/feature-map.mjs promote. Edit docs/feature-map instead.',
      app,
      appCommit,
      held,
      carried,
    })
  );
  fs.writeFileSync(path.join(root, ANCHORS_FILE), json(anchors));
  fs.writeFileSync(skillPath, skill);
  return {
    published,
    held,
    carried,
    entryCount: published.reduce((sum, item) => sum + item.entries.length, 0),
  };
}

// --- what to re-read after a change ----------------------------------------

const isAppSource = (file) =>
  SOURCE_ROOTS.some((root) => file.startsWith(`${root}/`)) &&
  !/\.(test|fixture)\.|\/test\//.test(file);

/**
 * `check` proves an entry's labels are still in the code. It cannot tell that
 * a tap now does something else, or that fewer people may do it. The entries
 * that could have gone wrong that way are the ones citing a file that changed,
 * so this lists them for a person or a model to read against the diff.
 *
 * `changed` is `[{ status, file, lines }]`: git's one-letter status and how
 * many lines the change added and removed. `before` is the same set of entries
 * as it stood earlier: an entry rewritten alongside the code has probably been
 * looked at, one left alone has not.
 *
 * Many entries cite the same few files, so the result also lists those files:
 * one diff read covers every entry that cites it.
 */
export function affectedEntries({ mapFiles, before = [], changed }) {
  const lines = new Map(changed.map((item) => [item.file, item.lines]));
  const earlier = new Map(
    before.flatMap(({ file, entries }) =>
      entries.map((entry) => [`${file}#${entry.slug}`, entry.body])
    )
  );
  const cited = new Set();
  const citing = new Map();
  const entries = [];
  for (const { file, entries: fileEntries } of mapFiles) {
    for (const entry of fileEntries) {
      for (const src of entry.src) cited.add(src);
      const hits = entry.src.filter((src) => lines.has(src));
      if (!hits.length) continue;
      for (const src of hits) citing.set(src, (citing.get(src) ?? 0) + 1);
      const was = earlier.get(`${file}#${entry.slug}`);
      entries.push({
        file,
        entry: entry.heading,
        state:
          was === undefined ? 'new' : was === entry.body ? 'same' : 'edited',
      });
    }
  }
  const uncited = changed.filter(
    ({ status, file }) =>
      status !== 'D' && isAppSource(file) && !cited.has(file)
  );
  const added = uncited.filter(({ status }) => status === 'A');
  return {
    entries,
    files: [...citing]
      .map(([file, count]) => ({
        file,
        lines: lines.get(file),
        entries: count,
      }))
      .sort((a, b) => b.lines - a.lines || a.file.localeCompare(b.file)),
    added: added.map(({ file }) => file),
    otherUncited: uncited.length - added.length,
  };
}

const AFFECTED_NOTES = {
  same: '',
  edited: ' (text changed too)',
  new: ' (new entry)',
};

/** Markdown, so it reads the same in a terminal, a job summary and a PR. */
export function renderAffected({ entries, files, added, otherUncited }, range) {
  const out = [];
  const plural = (count, noun) => `${count} ${noun}${count === 1 ? '' : 's'}`;
  if (entries.length) {
    const untouched = entries.filter(({ state }) => state === 'same').length;
    out.push(
      `### Entries to re-read: ${entries.length}`,
      '',
      `Each cites a file that changed ${range}; ${untouched} of them kept ` +
        'the same text. The check covers their quoted labels. What it cannot ' +
        'see is a change to who can do it, where it is, or what happens next.',
      ''
    );
    let file = '';
    for (const item of entries) {
      if (item.file !== file) {
        if (file) out.push('');
        file = item.file;
        out.push(`**${file}**`, '');
      }
      out.push(`- ${item.entry}${AFFECTED_NOTES[item.state]}`);
    }
    out.push(
      '',
      `### Changed files they cite: ${files.length}`,
      '',
      'Biggest change first. Reading one diff covers every entry that cites it.',
      '',
      ...files.map(
        (item) =>
          `- \`${item.file}\`: ${plural(item.lines, 'line')}, ` +
          `${item.entries} ${item.entries === 1 ? 'entry' : 'entries'}`
      )
    );
  } else {
    out.push(`No entry cites a file that changed ${range}.`);
  }
  if (added.length) {
    out.push(
      '',
      `### New files no entry cites: ${added.length}`,
      '',
      'If one adds something a person could ask how to do, it needs an entry.',
      '',
      ...added.map((file) => `- \`${file}\``)
    );
  }
  if (otherUncited) {
    out.push(
      '',
      `${plural(otherUncited, 'other changed source file')} cited by no ` +
        'entry. A behaviour change there is not on this list.'
    );
  }
  return out.join('\n');
}

/**
 * With `until`, what differs between the two named points, whichever is newer:
 * republishing for an older build is a change too. Without it, what this
 * checkout changed since it left `since`, so a branch that is behind does not
 * list the other side's work. A rename counts as one file removed, one added.
 */
function changedFiles(root, since, until) {
  const git = (args) =>
    execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
    });
  const base = until ? since : git(['merge-base', since, 'HEAD']).trim();
  const diff = (format) =>
    git(['diff', format, '--no-renames', '-z', base, ...(until ? [until] : [])])
      .split('\0')
      .filter(Boolean);
  const lines = new Map(
    diff('--numstat').map((row) => {
      const [added, removed, file] = row.split('\t');
      // Binary files report "-" for both counts.
      return [file, (Number(added) || 0) + (Number(removed) || 0)];
    })
  );
  const fields = diff('--name-status');
  const changed = [];
  for (let i = 0; i < fields.length; i += 2) {
    const file = fields[i + 1];
    changed.push({ status: fields[i], file, lines: lines.get(file) ?? 0 });
  }
  return { base, changed };
}

// --- command line ----------------------------------------------------------

function option(args, name) {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

function main(argv) {
  const [command, ...args] = argv;
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], {
    encoding: 'utf8',
  }).trim();
  const ref = option(args, '--ref');
  const reader = makeReader(root, ref);

  if (command === 'check') {
    const result = checkMap(reader);
    for (const { file, entry, problem } of result.failures) {
      console.log(`${file}${entry ? ` › ${entry}` : ''}: ${problem}`);
    }
    console.log(
      `${result.entryCount} entries in ${result.files.length} files; ` +
        `${result.covered.size} of ${result.surface.items.length} surface items covered, ` +
        `${result.ignored.length} skipped; ${result.failures.length} problems` +
        (ref ? ` (against ${ref})` : '')
    );
    return result.failures.length ? 1 : 0;
  }

  if (command === 'labels') {
    const file = args.find((arg) => !arg.startsWith('--') && arg !== ref);
    if (!file) return usage();
    const missing = checkLooseLabels(fs.readFileSync(file, 'utf8'), reader);
    for (const label of missing)
      console.log(`not in the app's source: \`${label}\``);
    console.log(
      `${missing.length} quoted labels not found${ref ? ` (against ${ref})` : ''}`
    );
    return missing.length ? 1 : 0;
  }

  if (command === 'surface') {
    const { items, missingSources } = readSurface(reader);
    for (const item of items) console.log(item);
    for (const file of missingSources) console.error(`could not read ${file}`);
    return missingSources.length ? 1 : 0;
  }

  if (command === 'affected') {
    const since = option(args, '--since');
    if (!since) return usage();
    const until = option(args, '--until');
    const { base, changed } = changedFiles(root, since, until);
    // At a release the question is about the copy bots read, and "the same
    // text" means the text this checkout is about to replace.
    const result = args.includes('--published')
      ? affectedEntries({
          mapFiles: readPublished(reader),
          before: readPublished(makeReader(root, 'HEAD')),
          changed,
        })
      : affectedEntries({
          mapFiles: readMap(reader),
          before: readMap(makeReader(root, base)),
          changed,
        });
    console.log(
      renderAffected(
        result,
        `between \`${since}\` and ${until ? `\`${until}\`` : 'this checkout'}`
      )
    );
    return 0;
  }

  if (command === 'promote') {
    const app = option(args, '--app');
    if (!app) return usage();
    const drop = (option(args, '--drop') ?? '').split(',').filter(Boolean);
    let result;
    try {
      result = promote(root, app, drop);
    } catch (error) {
      console.error(`nothing was published: ${error.message}`);
      return 1;
    }
    for (const { file, entry, kept, why } of result.held) {
      console.log(`held back: ${file} › ${entry} (${kept}): ${why[0]}`);
    }
    for (const { file, entry } of result.carried) {
      console.log(
        `still published, though gone from the map: ${file} › ${entry}`
      );
    }
    console.log(
      `published ${result.entryCount} entries in ${result.published.length} files for ${app}; ` +
        `${result.held.length} held back, ${result.carried.length} kept after leaving the map`
    );
    return 0;
  }

  return usage();
}

function usage() {
  console.error(
    'usage: feature-map.mjs check [--ref <git-ref>]\n' +
      '       feature-map.mjs labels <file.md> [--ref <git-ref>]\n' +
      '       feature-map.mjs surface [--ref <git-ref>]\n' +
      '       feature-map.mjs affected --since <git-ref> [--until <git-ref>] [--published]\n' +
      '       feature-map.mjs promote --app <release-tag> [--drop file.md#slug,…]'
  );
  return 2;
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])
) {
  process.exit(main(process.argv.slice(2)));
}
