/**
 * Assert that every workspace package is classified by one of the path
 * filters in .github/workflows/ci.yml.
 *
 * Why this exists: ci.yml gates its jobs on dorny/paths-filter outputs. The
 * `app` filter is an ignore-list (`**` minus exclusions, evaluated with
 * predicate-quantifier `every`) and the rest are positive lists. A package
 * that is excluded from the ignore-list but named in no positive list
 * matches NO filter, so a PR touching only that package runs no gated job
 * at all — and `CI OK` goes green on a diff nothing looked at. That is not
 * a hypothetical: the filters are hand-maintained lists of package paths
 * and every new package is an opportunity to forget one.
 *
 * The check reads the real workflow and the real workspace membership; it
 * hardcodes neither the package list nor the filter names, so it cannot
 * drift away from what it is guarding.
 *
 * Run: node scripts/check-ci-path-filters.mjs
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);
const workflowRelativePath = '.github/workflows/ci.yml';
const workflowPath = path.join(rootDirectory, workflowRelativePath);
const workspacePath = path.join(rootDirectory, 'pnpm-workspace.yaml');

const problems = [];

/* ------------------------------------------------------------------ */
/* globs                                                               */
/* ------------------------------------------------------------------ */

// dorny/paths-filter matches with picomatch. Only the subset the filters
// actually use is implemented here; anything richer is rejected loudly
// rather than silently mis-evaluated.
const unsupportedGlobSyntax = /[[\]{}()+@|]/;

const globToRegExp = (glob) => {
  if (unsupportedGlobSyntax.test(glob)) {
    throw new Error(
      `Unsupported glob syntax '${glob}' in ${workflowRelativePath}. ` +
        'Teach scripts/check-ci-path-filters.mjs about it before using it.'
    );
  }
  const segments = glob.split('/');
  let source = '^';
  segments.forEach((segment, index) => {
    const isLast = index === segments.length - 1;
    if (segment === '**') {
      // A trailing `**` matches the rest of the path; an interior one
      // matches zero or more whole path segments.
      source += isLast ? '.*' : '(?:[^/]*/)*';
      return;
    }
    source += segment
      .replace(/[.^$\\]/g, '\\$&')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '[^/]');
    if (!isLast) {
      source += '/';
    }
  });
  return new RegExp(`${source}$`);
};

const matchesGlob = (filePath, glob) => globToRegExp(glob).test(filePath);

/**
 * Evaluate one filter against one changed path, the way paths-filter does:
 * under `every` a file must match every pattern (a `!` pattern matches a
 * file that does NOT match its glob); under the default `some` a file need
 * match only one.
 */
const fileMatchesFilter = (filePath, filter) => {
  if (filter.quantifier === 'every') {
    return filter.patterns.every((pattern) =>
      pattern.startsWith('!')
        ? !matchesGlob(filePath, pattern.slice(1))
        : matchesGlob(filePath, pattern)
    );
  }
  return filter.patterns.some((pattern) => matchesGlob(filePath, pattern));
};

/* ------------------------------------------------------------------ */
/* ci.yml                                                              */
/* ------------------------------------------------------------------ */

const indentOf = (line) => line.length - line.trimStart().length;

/** Lines below `line index`, indented deeper than it, up to the first dedent. */
const indentedBlockAfter = (lines, index) => {
  const baseIndent = indentOf(lines[index]);
  const block = [];
  for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
    const line = lines[cursor];
    if (line.trim() === '') {
      block.push(line);
      continue;
    }
    if (indentOf(line) <= baseIndent) {
      break;
    }
    block.push(line);
  }
  return block;
};

/**
 * Find every `uses: dorny/paths-filter` step and pull its `filters:` block
 * plus its predicate-quantifier.
 */
const parsePathFilters = (workflow) => {
  const lines = workflow.split('\n');
  const filters = new Map();

  lines.forEach((line, index) => {
    if (!/^\s*(?:-\s+)?uses:\s*dorny\/paths-filter/.test(line)) {
      return;
    }
    const stepIndent = indentOf(line);
    // The step's body: every line from here to the next dedent past the
    // list-item indent (the `- name:`/`- uses:` column, two less than the
    // key column when `uses:` is not the first key).
    const bodyIndent = /^\s*-\s/.test(line) ? stepIndent : stepIndent - 2;
    const body = [line];
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const next = lines[cursor];
      if (next.trim() === '') {
        body.push(next);
        continue;
      }
      if (indentOf(next) <= bodyIndent) {
        break;
      }
      body.push(next);
    }

    const quantifierMatch = /predicate-quantifier:\s*["']?([a-z]+)/.exec(
      body.join('\n')
    );
    const quantifier = quantifierMatch ? quantifierMatch[1] : 'some';

    const filtersKeyIndex = body.findIndex((bodyLine) =>
      /^\s*filters:\s*\|/.test(bodyLine)
    );
    if (filtersKeyIndex === -1) {
      problems.push(
        `A dorny/paths-filter step in ${workflowRelativePath} has no inline ` +
          '`filters: |` block; this check can only read inline filters.'
      );
      return;
    }

    let currentName = null;
    for (const blockLine of indentedBlockAfter(body, filtersKeyIndex)) {
      if (blockLine.trim() === '' || blockLine.trim().startsWith('#')) {
        continue;
      }
      const nameMatch = /^\s*([A-Za-z_][\w-]*):\s*$/.exec(blockLine);
      if (nameMatch) {
        currentName = nameMatch[1];
        filters.set(currentName, {
          name: currentName,
          quantifier,
          patterns: [],
        });
        continue;
      }
      const patternMatch = /^\s*-\s+(.+?)\s*$/.exec(blockLine);
      if (patternMatch && currentName) {
        filters
          .get(currentName)
          .patterns.push(patternMatch[1].replace(/^['"]|['"]$/g, ''));
      }
    }
  });

  return [...filters.values()];
};

const workflow = await readFile(workflowPath, 'utf8');
const filters = parsePathFilters(workflow);

if (filters.length === 0) {
  problems.push(
    `No dorny/paths-filter filters found in ${workflowRelativePath}. If the ` +
      'gating moved, move this check with it.'
  );
}

for (const filter of filters) {
  if (filter.patterns.length === 0) {
    problems.push(
      `Filter '${filter.name}' in ${workflowRelativePath} is empty.`
    );
  }
  if (filter.quantifier !== 'every') {
    for (const pattern of filter.patterns) {
      if (pattern.startsWith('!')) {
        problems.push(
          `Filter '${filter.name}' uses the negated pattern '${pattern}' ` +
            "without predicate-quantifier 'every', where exclusions are dead " +
            'letters. Either add the quantifier or drop the pattern.'
        );
      }
    }
  }
  // A filter nothing reads is a filter that gates nothing.
  const referenced = new RegExp(
    `needs\\.[A-Za-z_][\\w-]*\\.outputs\\.${filter.name}\\b`
  ).test(workflow);
  if (!referenced) {
    problems.push(
      `Filter '${filter.name}' is defined in ${workflowRelativePath} but no ` +
        "job's condition reads needs.<job>.outputs." +
        `${filter.name}, so it gates nothing.`
    );
  }
}

/* ------------------------------------------------------------------ */
/* workspace membership                                                */
/* ------------------------------------------------------------------ */

const parseWorkspaceGlobs = (workspaceYaml) => {
  const lines = workspaceYaml.split('\n');
  const start = lines.findIndex((line) => /^packages:\s*$/.test(line));
  if (start === -1) {
    throw new Error(`No top-level 'packages:' list in ${workspacePath}.`);
  }
  const globs = [];
  for (const line of indentedBlockAfter(lines, start)) {
    if (line.trim() === '' || line.trim().startsWith('#')) {
      continue;
    }
    const match = /^\s*-\s+(.+?)\s*$/.exec(line);
    if (!match) {
      break;
    }
    globs.push(match[1].replace(/^['"]|['"]$/g, ''));
  }
  return globs;
};

const workspaceYaml = await readFile(workspacePath, 'utf8');
const workspaceGlobs = parseWorkspaceGlobs(workspaceYaml);

const packageDirectories = [];
for (const glob of workspaceGlobs) {
  const match = /^([\w./-]+)\/\*$/.exec(glob);
  if (!match) {
    throw new Error(
      `Unsupported workspace glob '${glob}' in pnpm-workspace.yaml. Teach ` +
        'scripts/check-ci-path-filters.mjs about it before using it.'
    );
  }
  const parent = match[1];
  const entries = await readdir(path.join(rootDirectory, parent), {
    withFileTypes: true,
  });
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const directory = `${parent}/${entry.name}`;
    try {
      await readFile(path.join(rootDirectory, directory, 'package.json'));
    } catch {
      continue;
    }
    packageDirectories.push(directory);
  }
}
packageDirectories.sort();

if (packageDirectories.length === 0) {
  problems.push(
    'Found no workspace packages; the workspace glob expansion is wrong.'
  );
}

/* ------------------------------------------------------------------ */
/* the assertion                                                       */
/* ------------------------------------------------------------------ */

// A PR touching only this file is the smallest possible change to the
// package: every package has one, and it is never a `.md`, so it is not
// let off by a docs exclusion.
const representativeFile = (directory) => `${directory}/package.json`;

for (const directory of packageDirectories) {
  const file = representativeFile(directory);
  const matched = filters.filter((filter) => fileMatchesFilter(file, filter));
  if (matched.length === 0) {
    problems.push(
      `${directory} is not classified by any path filter in ` +
        `${workflowRelativePath}: a PR touching only ${file} would match ` +
        'none of ' +
        filters.map((filter) => `'${filter.name}'`).join(', ') +
        ', so every gated job would skip and CI OK would pass without ' +
        'running anything. Add it to a positive filter (or stop excluding ' +
        'it from the ignore-list filter, if the app suite is what should ' +
        'cover it).'
    );
  }
}

// The other direction: a filter that names a package path which no longer
// exists is a stale classification, and the package it used to name may
// have been renamed out from under the gate.
const knownDirectories = new Set(packageDirectories);
const workspaceParents = new Set(
  workspaceGlobs.map((glob) => glob.replace(/\/\*$/, ''))
);
for (const filter of filters) {
  for (const pattern of filter.patterns) {
    const glob = pattern.replace(/^!/, '');
    const segments = glob.split('/');
    if (segments.length < 2 || !workspaceParents.has(segments[0])) {
      continue;
    }
    if (segments[1].includes('*')) {
      continue;
    }
    const directory = `${segments[0]}/${segments[1]}`;
    if (!knownDirectories.has(directory)) {
      problems.push(
        `Filter '${filter.name}' names '${pattern}' in ` +
          `${workflowRelativePath}, but ${directory} is not a workspace ` +
          'package. Stale filter entry, or the package moved.'
      );
    }
  }
}

/* ------------------------------------------------------------------ */
/* report                                                              */
/* ------------------------------------------------------------------ */

if (problems.length > 0) {
  for (const problem of problems) {
    console.error(`::error::${problem}`);
  }
  console.error(
    `\n${problems.length} problem(s) with the ${workflowRelativePath} path filters.`
  );
  process.exitCode = 1;
} else {
  console.log(
    `All ${packageDirectories.length} workspace packages are classified by ` +
      `the ${workflowRelativePath} path filters ` +
      `(${filters.map((filter) => filter.name).join(', ')}).`
  );
}
