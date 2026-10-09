#!/usr/bin/env node
// Keeps the product guide's feature map honest against the app's source.
//
// The map describes the app at one store build, recorded in release.json. It
// is brought up to date once per build, not on every change to develop, so
// every command here reads the app's source at that build unless told another.
//
//   check    every entry's quoted labels exist in the files it cites, its
//            "absent" terms appear nowhere, and every screen, message action,
//            feature flag and slash command is covered or explicitly skipped
//   labels   loose check for a Markdown file without anchors: each quoted
//            label must appear somewhere in the app's source
//   surface  print the inventory the coverage check uses
//   affected list the entries citing files that changed between the recorded
//            build and a newer one: the work list for bringing the map up to it
//   next     print the tag of a store build newer than the recorded one, if
//            there is one
//   publish  write the copy bots read from the map; with --app, first record
//            that the map now describes that build
//
// See docs/feature-map/README.md for the entry format and the release steps.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const MAP_DIR = 'docs/feature-map';
export const SKILL_DIR = 'packages/openclaw/skills/tlon-product-guide';
export const PUBLISHED_DIR = `${SKILL_DIR}/references`;
const IGNORE_FILE = `${MAP_DIR}/surface-ignore.txt`;
const FLAG_WORDS_FILE = `${MAP_DIR}/flag-words.txt`;
const QUESTIONS_DIR = `${MAP_DIR}/questions`;
// The store build the map describes: its tag, and the commit the tag pointed
// at. The commit is what gets read, since a build's tag can be moved.
const RELEASE_FILE = `${MAP_DIR}/release.json`;
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
  'apps/tlon-mobile/android',
  'apps/tlon-mobile/ios',
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

/** A reader over the app's source at `ref`, which must be in this checkout. */
function codeAt(root, ref) {
  try {
    execFileSync('git', ['cat-file', '-e', `${ref}^{commit}`], {
      cwd: root,
      stdio: 'ignore',
    });
  } catch {
    throw new Error(
      `${ref} is not in this checkout; fetch it first (git fetch origin ${ref})`
    );
  }
  return makeReader(root, ref);
}

// --- surface inventory -----------------------------------------------------

/** Keys one level inside the braces of every `export type …ParamList`. */
function routeNames(text) {
  const names = new Set();
  let depth = 0;
  let inList = false;
  // What sits one level inside the list's braces, with deeper levels cut out.
  // Collected by character, not by line, so a key on the same line as its
  // opening brace (`> & { ChannelRoot: … };`) is read too.
  let top = '';
  for (const line of text.split('\n')) {
    // A declaration runs to its closing `;`, so a list written as
    // `Pick<…> & {` with the brace on a later line is still read.
    if (depth === 0 && /^export type \w+ParamList\b/.test(line)) inList = true;
    for (const char of line) {
      if (char === '}') depth -= 1;
      if (inList && depth === 1) top += char;
      if (char === '{') {
        depth += 1;
        if (inList && depth === 1) top += '{';
      }
    }
    top += '\n';
    if (depth === 0 && /;\s*$/.test(line)) {
      for (const key of top.matchAll(/(?:^|[{};,\n])\s*([A-Z]\w+)\??:/g)) {
        names.add(key[1]);
      }
      top = '';
      inList = false;
    }
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

/** The lines of one of the map's small list files, without comments. */
function listLines(reader, file) {
  return (reader.read(file) ?? '')
    .split('\n')
    .map((line) => line.replace(/#.*$/, '').trim())
    .filter(Boolean);
}

function readIgnored(reader) {
  return listLines(reader, IGNORE_FILE);
}

/** `[flag, words]` pairs: the words that give each flagged feature away. */
function readFlagWords(reader) {
  return listLines(reader, FLAG_WORDS_FILE).map((line) => {
    const [flag, words = ''] = line.split(':');
    return [flag.trim(), splitList(words)];
  });
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

/**
 * Flagged features that `text` talks about in its own words without carrying
 * the flag. `publish` leaves an entry out by its flag anchor, so a sentence
 * about the feature in an unmarked entry would be published all the same. A
 * quoted label does not count: the label check proves that text is on screen.
 */
export function flagLeaks(text, ownFlags, flagWords) {
  const prose = normalize(
    stripAnchors(text)
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`[^`\n]+`/g, '')
  );
  const leaks = [];
  for (const [flag, words] of flagWords) {
    if (ownFlags.includes(flag)) continue;
    const word = words.find((item) => includesWhole(prose, item));
    if (word) leaks.push({ flag, word });
  }
  return leaks;
}

/**
 * Check the map against the app's source. `map` reads the map and its side
 * files, from this checkout. `code` reads the app's source, at the store build
 * the map describes.
 */
export function checkMap(map, code) {
  const files = readMap(map);
  const failures = [];
  const slugs = new Map();
  const covered = new Set();
  const surface = readSurface(code);
  const flags = surface.items
    .filter((item) => item.startsWith('flag:'))
    .map((item) => item.slice(5));
  const flagWords = readFlagWords(map);
  for (const [flag] of flagWords) {
    if (!flags.includes(flag)) {
      failures.push({
        file: FLAG_WORDS_FILE,
        problem: `lists flag ${flag}, which is not in the code`,
      });
    }
  }
  for (const file of files) {
    if (!file.title)
      failures.push({ file: file.file, problem: 'no `# ` title' });
    for (const { flag, word } of flagLeaks(
      `${file.title}\n${file.intro}`,
      [],
      flagWords
    )) {
      failures.push({
        file: file.file,
        problem: `its opening lines say "${word}", which is behind the ${flag} flag; a file's opening lines are always published`,
      });
    }
    for (const entry of file.entries) {
      const where = { file: file.file, entry: entry.heading };
      for (const { flag, word } of flagLeaks(
        `${entry.heading}\n${entry.raw}`,
        entry.flag,
        flagWords
      )) {
        failures.push({
          ...where,
          problem: `says "${word}", which is behind the ${flag} flag: add \`<!-- flag: ${flag} -->\` or move that sentence to an entry that has it`,
        });
      }
      const key = `${file.file}#${entry.slug}`;
      if (slugs.has(key))
        failures.push({ ...where, problem: 'duplicate heading' });
      slugs.set(key, true);
      for (const problem of checkEntry(entry, code)) {
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
  failures.push(...checkQuestions(map, files));
  const ignored = readIgnored(map);
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

// --- publish ---------------------------------------------------------------

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

/** The store build the map describes, from RELEASE_FILE. */
export function recordedBuild(reader) {
  const text = reader.read(RELEASE_FILE);
  if (text === null) throw new Error(`${RELEASE_FILE} is missing`);
  return JSON.parse(text);
}

/**
 * What bots read: the map without its anchors, and without the entries for a
 * feature whose flag is not on by default in the build. `flagsOn` is the set
 * of flags the build turns on.
 */
export function publishedFiles(mapFiles, flagsOn) {
  const leftOut = [];
  const published = [];
  for (const file of mapFiles) {
    const entries = [];
    for (const entry of file.entries) {
      const off = entry.flag.find((flag) => !flagsOn.has(flag));
      if (off)
        leftOut.push({ file: file.file, entry: entry.heading, flag: off });
      else entries.push(entry);
    }
    if (entries.length) published.push({ name: file.file, file, entries });
  }
  return { published, leftOut };
}

/**
 * Write the copy bots read. With `app`, the map is first checked against that
 * build and, if it holds, the build is recorded as the one the map describes.
 * Nothing is written unless the map passes its check: a published copy that
 * quotes a label the build does not have is worse than a stale one.
 */
export function publish(root, app) {
  const map = makeReader(root);
  let build;
  if (app) {
    try {
      const commit = execFileSync(
        'git',
        ['rev-parse', '--verify', '--quiet', `${app}^{commit}`],
        { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
      ).trim();
      build = { app, commit };
    } catch {
      throw new Error(`no such build in this checkout: ${app}`);
    }
  } else {
    build = recordedBuild(map);
  }
  const code = codeAt(root, build.commit);
  const { files, failures } = checkMap(map, code);
  if (failures.length) {
    throw new Error(
      `the map has ${failures.length} problems against ${build.app}; ` +
        `see \`feature-map.mjs check --ref ${build.app}\``
    );
  }
  const flagsOn = new Set(
    [
      ...(code.read(SURFACE_SOURCES.flag) ?? '').matchAll(
        /^ {2}(\w+): \{\s*default: true/gm
      ),
    ].map((m) => m[1])
  );
  const { published, leftOut } = publishedFiles(files, flagsOn);
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
  for (const { name, file, entries } of published) {
    fs.writeFileSync(path.join(outDir, name), renderPublished(file, entries));
  }
  fs.writeFileSync(skillPath, skill);
  if (app) {
    fs.writeFileSync(
      path.join(root, RELEASE_FILE),
      `${JSON.stringify(build, null, 2)}\n`
    );
  }
  return {
    build,
    published,
    leftOut,
    entryCount: published.reduce((sum, item) => sum + item.entries.length, 0),
  };
}

// --- what to re-read for a newer build --------------------------------------

const isAppSource = (file) =>
  SOURCE_ROOTS.some((root) => file.startsWith(`${root}/`)) &&
  !/\.(test|fixture)\.|\/test\//.test(file);

/**
 * The work list for bringing the map up to a newer build. `check` against the
 * new build finds the labels and screens that changed. It cannot tell that a
 * tap now does something else, or that fewer people may do it. The entries
 * that could have gone wrong that way are the ones citing a file that changed
 * between the two builds, so this lists them to be read against the diff.
 *
 * `changed` is `[{ status, file, lines }]`: git's one-letter status and how
 * many lines the change added and removed.
 *
 * Many entries cite the same few files, so the result also lists those files:
 * one diff read covers every entry that cites it.
 */
export function affectedEntries({ mapFiles, changed }) {
  const lines = new Map(changed.map((item) => [item.file, item.lines]));
  const cited = new Set();
  const citing = new Map();
  const entries = [];
  for (const { file, entries: fileEntries } of mapFiles) {
    for (const entry of fileEntries) {
      for (const src of entry.src) cited.add(src);
      const hits = entry.src.filter((src) => lines.has(src));
      if (!hits.length) continue;
      for (const src of hits) citing.set(src, (citing.get(src) ?? 0) + 1);
      entries.push({ file, entry: entry.heading });
    }
  }
  const uncited = changed.filter(
    ({ status, file }) =>
      status !== 'D' && isAppSource(file) && !cited.has(file)
  );
  const biggestFirst = (a, b) =>
    b.lines - a.lines || a.file.localeCompare(b.file);
  return {
    entries,
    files: [...citing]
      .map(([file, count]) => ({
        file,
        lines: lines.get(file),
        entries: count,
      }))
      .sort(biggestFirst),
    added: uncited
      .filter(({ status }) => status === 'A')
      .map(({ file }) => file),
    // Changed files nothing cites. A new button on an existing screen lands
    // in one of these and trips no check, so they are named, not counted.
    uncited: uncited
      .filter(({ status }) => status !== 'A')
      .map(({ file, lines: count }) => ({ file, lines: count }))
      .sort(biggestFirst),
  };
}

/** Markdown, so it reads the same in a terminal and in a PR. */
export function renderAffected({ entries, files, added, uncited }, range) {
  const out = [];
  const plural = (count, noun) => `${count} ${noun}${count === 1 ? '' : 's'}`;
  if (entries.length) {
    out.push(
      `### Entries to re-read: ${entries.length}`,
      '',
      `Each cites a file that changed ${range}. The check covers their ` +
        'quoted labels. What it cannot see is a change to who can do it, ' +
        'where it is, or what happens next.',
      ''
    );
    let file = '';
    for (const item of entries) {
      if (item.file !== file) {
        if (file) out.push('');
        file = item.file;
        out.push(`**${file}**`, '');
      }
      out.push(`- ${item.entry}`);
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
  if (uncited.length) {
    out.push(
      '',
      `### Changed files no entry cites: ${uncited.length}`,
      '',
      'Biggest change first. A new button or menu item on an existing screen ' +
        'shows up here and nowhere else.',
      '',
      ...uncited.map(
        (item) => `- \`${item.file}\`: ${plural(item.lines, 'line')}`
      )
    );
  }
  return out.join('\n');
}

/** What differs between two commits. A rename counts as one file removed, one added. */
function changedFiles(root, since, until) {
  const diff = (format) =>
    execFileSync('git', ['diff', format, '--no-renames', '-z', since, until], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
    })
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
  return changed;
}

// --- finding the next build ------------------------------------------------

/**
 * The build the map should describe next, if it is not there already: the
 * newest store build, or the older of the two when iOS and Android are on
 * different commits, so every step holds on both phones. `ios` and `android`
 * are `{ tag, commit }` for the newest build of each, `recorded` is the commit
 * the map describes, and `isAncestor(a, b)` says whether `a` is in `b`'s
 * history.
 */
export function nextBuild({ ios, android, recorded, isAncestor }) {
  let pick = ios ?? android;
  if (
    ios &&
    android &&
    ios.commit !== android.commit &&
    isAncestor(android.commit, ios.commit)
  ) {
    pick = android;
  }
  // Not newer than what the map describes: nothing to do.
  if (!pick || pick.commit === recorded || !isAncestor(recorded, pick.commit)) {
    return undefined;
  }
  return pick.tag;
}

function newestBuilds(root) {
  const git = (args) =>
    execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  const newest = (platform) => {
    const [tag] = git([
      'tag',
      '--list',
      `${platform}-production-*`,
      '--sort=-v:refname',
    ]).split('\n');
    return tag
      ? { tag, commit: git(['rev-parse', `${tag}^{commit}`]) }
      : undefined;
  };
  return {
    ios: newest('ios'),
    android: newest('android'),
    isAncestor: (a, b) => {
      try {
        execFileSync('git', ['merge-base', '--is-ancestor', a, b], {
          cwd: root,
          stdio: 'ignore',
        });
        return true;
      } catch {
        return false;
      }
    },
  };
}

// --- command line ----------------------------------------------------------

function option(args, name) {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

function run(argv) {
  const [command, ...args] = argv;
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], {
    encoding: 'utf8',
  }).trim();
  const map = makeReader(root);
  // The app's source is read at the build the map describes, unless --ref
  // names another: the next build, say, to see what it breaks.
  const ref = option(args, '--ref');
  const build = () => recordedBuild(map);
  const code = () => codeAt(root, ref ?? build().commit);
  const against = () => ref ?? build().app;

  if (command === 'check') {
    const result = checkMap(map, code());
    for (const { file, entry, problem } of result.failures) {
      console.log(`${file}${entry ? ` › ${entry}` : ''}: ${problem}`);
    }
    console.log(
      `${result.entryCount} entries in ${result.files.length} files; ` +
        `${result.covered.size} of ${result.surface.items.length} surface items covered, ` +
        `${result.ignored.length} skipped; ${result.failures.length} problems ` +
        `against ${against()}`
    );
    return result.failures.length ? 1 : 0;
  }

  if (command === 'labels') {
    const file = args.find((arg) => !arg.startsWith('--') && arg !== ref);
    if (!file) return usage();
    const missing = checkLooseLabels(fs.readFileSync(file, 'utf8'), code());
    for (const label of missing)
      console.log(`not in the app's source: \`${label}\``);
    console.log(
      `${missing.length} quoted labels not found against ${against()}`
    );
    return missing.length ? 1 : 0;
  }

  if (command === 'surface') {
    const { items, missingSources } = readSurface(code());
    for (const item of items) console.log(item);
    for (const file of missingSources) console.error(`could not read ${file}`);
    return missingSources.length ? 1 : 0;
  }

  if (command === 'affected') {
    const until = option(args, '--until');
    if (!until) return usage();
    const since = option(args, '--since') ?? build().commit;
    const sinceName = option(args, '--since') ?? build().app;
    codeAt(root, since);
    codeAt(root, until);
    const result = affectedEntries({
      mapFiles: readMap(map),
      changed: changedFiles(root, since, until),
    });
    console.log(
      renderAffected(result, `between \`${sinceName}\` and \`${until}\``)
    );
    return 0;
  }

  if (command === 'next') {
    const tag = nextBuild({
      ...newestBuilds(root),
      recorded: build().commit,
    });
    if (tag) console.log(tag);
    return 0;
  }

  if (command === 'publish') {
    const result = publish(root, option(args, '--app'));
    for (const { file, entry, flag } of result.leftOut) {
      console.log(
        `left out: ${file} › ${entry} (flag ${flag} is off in this build)`
      );
    }
    console.log(
      `published ${result.entryCount} entries in ${result.published.length} files ` +
        `for ${result.build.app}; ${result.leftOut.length} left out`
    );
    return 0;
  }

  return usage();
}

function main(argv) {
  try {
    return run(argv);
  } catch (error) {
    console.error(error.message);
    return 1;
  }
}

function usage() {
  console.error(
    'usage: feature-map.mjs check [--ref <git-ref>]\n' +
      '       feature-map.mjs labels <file.md> [--ref <git-ref>]\n' +
      '       feature-map.mjs surface [--ref <git-ref>]\n' +
      '       feature-map.mjs affected --until <git-ref> [--since <git-ref>]\n' +
      '       feature-map.mjs next\n' +
      '       feature-map.mjs publish [--app <build-tag>]'
  );
  return 2;
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])
) {
  process.exit(main(process.argv.slice(2)));
}
