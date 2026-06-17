#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const args = new Set(process.argv.slice(2));
const validArgs = new Set(['--json', '--strict']);
const invalidArgs = [...args].filter((arg) => !validArgs.has(arg));
const strict = args.has('--strict');
const jsonOutput = args.has('--json');
const root = process.cwd();
const manifestPath = path.join(root, 'packages/tlon-e2e/scenarios.json');
const tagPattern = /@tlon-e2e\s+([a-z0-9_-]+)\s*:\s*([^\n\r*]+)/gi;

if (invalidArgs.length > 0) {
  console.error(`Unknown option: ${invalidArgs.join(', ')}`);
  process.exit(2);
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function walk(dir) {
  if (!existsSync(dir)) {
    return [];
  }
  const entries = readdirSync(dir).sort();
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...walk(fullPath));
    } else if (/\.(test\.)?[cm]?[jt]sx?$/.test(entry)) {
      files.push(fullPath);
    }
  }
  return files;
}

function splitScenarioIds(raw) {
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function collectTags(manifest) {
  const coverage = new Map();
  const unknown = [];
  const scenarioIds = new Set(
    manifest.scenarios.map((scenario) => scenario.id)
  );
  const platformIds = new Set(Object.keys(manifest.platforms));

  for (const [platformId, platform] of Object.entries(manifest.platforms)) {
    const testDir = path.join(root, platform.testDir);
    for (const file of walk(testDir)) {
      const relFile = path.relative(root, file);
      const contents = readFileSync(file, 'utf8');
      for (const match of contents.matchAll(tagPattern)) {
        const tagPlatform = match[1];
        const scenarioIdsRaw = splitScenarioIds(match[2]);
        if (!platformIds.has(tagPlatform)) {
          unknown.push({
            type: 'platform',
            value: tagPlatform,
            file: relFile,
          });
          continue;
        }
        if (tagPlatform !== platformId) {
          unknown.push({
            type: 'platform-mismatch',
            value: `${tagPlatform} tag under ${platformId} test dir`,
            file: relFile,
          });
        }
        for (const scenarioId of scenarioIdsRaw) {
          if (!scenarioIds.has(scenarioId)) {
            unknown.push({
              type: 'scenario',
              value: scenarioId,
              file: relFile,
            });
            continue;
          }
          const key = `${tagPlatform}:${scenarioId}`;
          const locations = coverage.get(key) ?? [];
          locations.push(relFile);
          coverage.set(key, locations);
        }
      }
    }
  }

  return { coverage, unknown };
}

function buildRows(manifest, coverage) {
  const groupIds = new Set((manifest.groups ?? []).map((group) => group.id));
  return manifest.scenarios.map((scenario) => {
    const desired = new Set(scenario.platforms);
    const platforms = Object.fromEntries(
      Object.keys(manifest.platforms).map((platformId) => {
        const key = `${platformId}:${scenario.id}`;
        const locations = coverage.get(key) ?? [];
        return [
          platformId,
          {
            desired: desired.has(platformId),
            present: locations.length > 0,
            locations,
          },
        ];
      })
    );

    return {
      id: scenario.id,
      group: groupIds.has(scenario.group) ? scenario.group : 'ungrouped',
      title: scenario.title,
      platforms,
    };
  });
}

function pad(value, width) {
  return String(value).padEnd(width, ' ');
}

function truncate(value, width) {
  const text = String(value);
  if (text.length <= width) {
    return text;
  }
  if (width <= 3) {
    return text.slice(0, width);
  }
  return `${text.slice(0, width - 3)}...`;
}

function countRowsForPlatform(rows, platformId) {
  let desired = 0;
  let present = 0;
  for (const row of rows) {
    const state = row.platforms[platformId];
    if (!state.desired) {
      continue;
    }
    desired += 1;
    if (state.present) {
      present += 1;
    }
  }
  return { desired, present, missing: desired - present };
}

function formatCount(count) {
  const suffix = count.missing ? `, ${count.missing} missing` : '';
  return `${count.present}/${count.desired}${suffix}`;
}

function statusCell(state) {
  if (!state.desired) {
    return 'n/a';
  }
  return state.present ? 'ok' : 'missing';
}

function groupRows(manifest, rows) {
  const groups = (manifest.groups ?? []).map((group) => ({
    ...group,
    rows: rows.filter((row) => row.group === group.id),
  }));
  const ungrouped = rows.filter((row) => row.group === 'ungrouped');
  if (ungrouped.length > 0) {
    groups.push({
      id: 'ungrouped',
      title: 'Ungrouped',
      files: {},
      rows: ungrouped,
    });
  }
  return groups.filter((group) => group.rows.length > 0);
}

function printGroupFiles(manifest, group) {
  const platformIds = Object.keys(manifest.platforms);
  const lines = platformIds
    .map((platformId) => {
      const file = group.files?.[platformId];
      if (!file) {
        return null;
      }
      return `  ${pad(manifest.platforms[platformId].label + ':', 10)} ${file}`;
    })
    .filter(Boolean);
  if (lines.length === 0) {
    return;
  }
  console.log('Files:');
  for (const line of lines) {
    console.log(line);
  }
}

function printScenarioTable(manifest, rows) {
  const platformIds = Object.keys(manifest.platforms);
  const scenarioWidth = Math.max(
    'Scenario'.length,
    ...rows.map((row) => row.id.length)
  );
  const titleWidth = Math.min(
    58,
    Math.max('Title'.length, ...rows.map((row) => row.title.length))
  );

  const headers = [
    pad('Scenario', scenarioWidth),
    pad('Title', titleWidth),
    ...platformIds.map((id) => pad(manifest.platforms[id].label, 9)),
  ];
  console.log(headers.join('  '));
  console.log(
    [
      '-'.repeat(scenarioWidth),
      '-'.repeat(titleWidth),
      ...platformIds.map(() => '-'.repeat(9)),
    ].join('  ')
  );

  for (const row of rows) {
    const cells = platformIds.map((platformId) => {
      return pad(statusCell(row.platforms[platformId]), 9);
    });
    console.log(
      [
        pad(row.id, scenarioWidth),
        pad(truncate(row.title, titleWidth), titleWidth),
        ...cells,
      ].join('  ')
    );
  }
}

function printGroupedReport(manifest, rows, summary) {
  const platformIds = Object.keys(manifest.platforms);

  console.log('Tlon E2E Coverage');
  console.log('');
  console.log(
    platformIds
      .map((platformId) => {
        const label = manifest.platforms[platformId].label;
        return `${label}: ${formatCount(summary[platformId])}`;
      })
      .join('  |  ')
  );

  for (const group of groupRows(manifest, rows)) {
    console.log('');
    console.log(`== ${group.id} - ${group.title} ==`);
    printGroupFiles(manifest, group);
    console.log(
      'Coverage: ' +
        platformIds
          .map((platformId) => {
            const label = manifest.platforms[platformId].label;
            return `${label} ${formatCount(countRowsForPlatform(group.rows, platformId))}`;
          })
          .join('  |  ')
    );
    console.log('');
    printScenarioTable(manifest, group.rows);
  }
}

function summarize(manifest, rows) {
  const platformIds = Object.keys(manifest.platforms);
  const summary = {};
  for (const platformId of platformIds) {
    let desired = 0;
    let present = 0;
    let missing = 0;
    for (const row of rows) {
      const state = row.platforms[platformId];
      if (!state.desired) {
        continue;
      }
      desired += 1;
      if (state.present) {
        present += 1;
      } else {
        missing += 1;
      }
    }
    summary[platformId] = { desired, present, missing };
  }
  return summary;
}

function missingRows(rows) {
  const missing = [];
  for (const row of rows) {
    for (const [platformId, state] of Object.entries(row.platforms)) {
      if (state.desired && !state.present) {
        missing.push({ scenario: row.id, platform: platformId });
      }
    }
  }
  return missing;
}

function printMissingByGroup(manifest, rows) {
  const platformIds = Object.keys(manifest.platforms);
  let printedHeader = false;
  for (const group of groupRows(manifest, rows)) {
    const missing = [];
    for (const row of group.rows) {
      for (const platformId of platformIds) {
        const state = row.platforms[platformId];
        if (state.desired && !state.present) {
          missing.push({ platformId, scenarioId: row.id });
        }
      }
    }
    if (missing.length === 0) {
      continue;
    }
    if (!printedHeader) {
      console.log('');
      console.log('Missing desired coverage by target file:');
      printedHeader = true;
    }
    console.log(`  ${group.id} - ${group.title}`);
    const byPlatform = new Map();
    for (const item of missing) {
      const list = byPlatform.get(item.platformId) ?? [];
      list.push(item.scenarioId);
      byPlatform.set(item.platformId, list);
    }
    for (const [platformId, scenarioIds] of byPlatform.entries()) {
      const label = manifest.platforms[platformId].label;
      const file = group.files?.[platformId] ?? '(no target file)';
      console.log(`    ${label}: ${file}`);
      for (const scenarioId of scenarioIds) {
        console.log(`      - ${scenarioId}`);
      }
    }
  }
}

const manifest = readJson(manifestPath);
const { coverage, unknown } = collectTags(manifest);
const rows = buildRows(manifest, coverage);
const missing = missingRows(rows);
const summary = summarize(manifest, rows);

if (jsonOutput) {
  console.log(
    JSON.stringify(
      { groups: groupRows(manifest, rows), rows, summary, missing, unknown },
      null,
      2
    )
  );
} else {
  printGroupedReport(manifest, rows, summary);
  if (unknown.length > 0) {
    console.log('');
    console.log('Unknown tags:');
    for (const item of unknown) {
      console.log(`  ${item.file}: ${item.type} ${item.value}`);
    }
  }
  printMissingByGroup(manifest, rows);
}

if (unknown.length > 0 || (strict && missing.length > 0)) {
  process.exit(1);
}
