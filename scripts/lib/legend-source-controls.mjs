import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(path.resolve('package.json'));
const { parse } = require('acorn');
export const sha256 = (value) =>
  crypto.createHash('sha256').update(value).digest('hex');
function readOptions() {
  const options = {};
  for (let i = 2; i < process.argv.length; i += 2) {
    const name = process.argv[i];
    assert.ok(
      ['--source-dir', '--report'].includes(name),
      `Unknown option: ${name}`
    );
    assert.ok(!(name in options), `Repeated option: ${name}`);
    assert.ok(
      process.argv[i + 1] && !process.argv[i + 1].startsWith('--'),
      `Missing value: ${name}`
    );
    options[name] = path.resolve(process.argv[i + 1]);
  }
  return options;
}

/** Read, parse and extract actual dependency declarations. Never supply stand-ins. */
export function extractDeclarations(
  source,
  { functions, optionalFunctions = [], variables = [] }
) {
  const { tree, text } = source;
  const declarations = tree.body.flatMap((node) => {
    if (node.type === 'FunctionDeclaration') {
      return [
        {
          name: node.id.name,
          kind: 'function',
          node,
        },
      ];
    }
    if (node.type === 'VariableDeclaration') {
      return node.declarations.map((declaration) => ({
        name: declaration.id.name,
        kind: 'variable',
        node,
      }));
    }
    return [];
  });
  const exact = (name, kind) => {
    const matches = declarations.filter(
      (entry) => entry.name === name && entry.kind === kind
    );
    assert.equal(
      matches.length,
      1,
      `Required installed ${kind} missing or duplicated: ${name}`
    );
    return matches[0];
  };
  const presentOptional = optionalFunctions.filter((name) =>
    declarations.some(
      (entry) => entry.name === name && entry.kind === 'function'
    )
  );
  assert.ok(
    presentOptional.length === 0 ||
      presentOptional.length === optionalFunctions.length,
    'Installed repair-helper group is only partially present'
  );
  const selected = [
    ...functions.map((name) => exact(name, 'function')),
    ...presentOptional.map((name) => exact(name, 'function')),
    ...variables.map((name) => exact(name, 'variable')),
  ];
  // The command handoff adds one private callee to these existing actual
  // bodies. Archived unpatched bases deliberately keep their original scope.
  if (
    (functions.includes('scrollTo') ||
      functions.includes('calculateItemsInView')) &&
    declarations.some((entry) => entry.name === 'retainOwnedNativeViewport') &&
    !selected.some((entry) => entry.name === 'retainOwnedNativeViewport')
  )
    selected.push(exact('retainOwnedNativeViewport', 'function'));
  if (
    declarations.some((entry) => entry.name === 'routesNativeReadAdjustment') &&
    selected.some((entry) =>
      ['requestAdjust', 'prepareMVCP', 'shouldQueueNativeMVCPAdjust'].includes(
        entry.name
      )
    ) &&
    !selected.some((entry) => entry.name === 'routesNativeReadAdjustment')
  )
    selected.push(exact('routesNativeReadAdjustment', 'function'));
  // Pending acquisition adds private position-hold callees; execute their
  // actual source whenever a selected body references them.
  const acquisitionHelpers = [
    'getNativeAcquisitionPositions',
    'captureNativeAcquisitionPositions',
    'getNativeAcquisitionPosition',
  ];
  if (
    declarations.some((entry) => acquisitionHelpers.includes(entry.name)) &&
    selected.some((entry) =>
      [
        'retainOwnedNativeViewport',
        'prepareMVCP',
        'createImperativeHandle',
        'syncMountedContainer',
      ].includes(entry.name)
    )
  ) {
    for (const name of acquisitionHelpers)
      if (!selected.some((entry) => entry.name === name))
        selected.push(exact(name, 'function'));
  }
  const nodes = [...new Set(selected.map((entry) => entry.node))].sort(
    (a, b) => a.start - b.start
  );
  return {
    bodies: nodes.map((node) => text.slice(node.start, node.end)).join('\n\n'),
    names: selected.map((entry) => entry.name),
  };
}

/** Preserve the exact closure assignment used by the installed list. */
export function extractReprocessAssignment({ tree, text }) {
  const matches = [];
  function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (
      node.type === 'AssignmentExpression' &&
      node.left.type === 'MemberExpression' &&
      node.left.object.name === 'internalState' &&
      node.left.property.name === 'reprocessCurrentScroll'
    )
      matches.push(node);
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === 'object') walk(value);
    }
  }
  walk(tree);
  assert.equal(
    matches.length,
    1,
    'Installed reprocessCurrentScroll assignment missing or duplicated'
  );
  return text.slice(matches[0].start, matches[0].end);
}
export async function runInstalledControls(suite, runVariant) {
  const options = readOptions();
  const directory =
    options['--source-dir'] ??
    path.dirname(require.resolve('@legendapp/list/react-native'));
  const variants = [];
  for (const variant of ['react-native.js', 'react-native.mjs']) {
    const file = path.join(directory, variant);
    let sourceHash;
    try {
      const text = fs.readFileSync(file, 'utf8');
      sourceHash = sha256(text);
      const tree = parse(text, {
        ecmaVersion: 'latest',
        sourceType: variant.endsWith('.mjs') ? 'module' : 'script',
      });
      const result = await runVariant({
        text,
        tree,
        file,
        variant,
        sourceHash,
      });
      assert.ok(
        Array.isArray(result.results) && result.results.length > 0,
        'No controls executed'
      );
      assert.ok(
        result.results.every((entry) =>
          ['PASS', 'FAIL'].includes(entry.status)
        ),
        'Invalid control status'
      );
      variants.push({
        ...result,
        variant,
        sourcePath: file,
        sourceHash,
        passed: result.results.filter((entry) => entry.status === 'PASS')
          .length,
        failed: result.results.filter((entry) => entry.status === 'FAIL')
          .length,
      });
    } catch (error) {
      variants.push({
        variant,
        sourcePath: file,
        sourceHash,
        passed: 0,
        failed: 1,
        results: [
          {
            name: 'source acquisition or suite execution',
            status: 'FAIL',
            error: error.message,
          },
        ],
      });
    }
  }
  const report = {
    schemaVersion: 1,
    suite,
    recordedAt: new Date().toISOString(),
    boundary:
      'Actual installed JavaScript bodies; native delivery, scheduler and peripheral rendering are modeled. No simulator, native animation cancellation or presentation proof.',
    passed: variants.reduce((total, variant) => total + variant.passed, 0),
    failed: variants.reduce((total, variant) => total + variant.failed, 0),
    variants,
  };
  if (options['--report'])
    fs.writeFileSync(
      options['--report'],
      JSON.stringify(report, null, 2) + '\n'
    );
  for (const variant of variants) {
    console.log(
      `${suite} ${variant.variant}: ${variant.passed} passed, ${variant.failed} failed`
    );
    for (const result of variant.results.filter(
      (entry) => entry.status === 'FAIL'
    )) {
      console.error(
        `FAIL ${result.name}: ${result.error ?? result.message ?? 'assertion failed'}`
      );
    }
  }
  process.exitCode = report.failed ? 1 : 0;
  return report;
}
