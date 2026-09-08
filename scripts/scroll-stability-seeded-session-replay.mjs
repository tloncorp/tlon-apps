import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

// Load only the actual source assessors and retain their exact byte hashes.
// No attached producer verdict is consumed.
export function replaySeededSession(
  raw,
  declaration,
  root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
) {
  const require = createRequire(path.join(root, 'package.json'));
  const ts = require('typescript');
  const cache = new Map();
  const sourceHashes = {};
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const source = fs.readFileSync(file, 'utf8');
    sourceHashes[path.relative(root, file)] = crypto
      .createHash('sha256')
      .update(source)
      .digest('hex');
    const code = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText;
    const module = { exports: {} };
    cache.set(file, module);
    new Function('require', 'module', 'exports', code)(
      (id) =>
        id.startsWith('.')
          ? load(path.resolve(path.dirname(file), id + '.ts'))
          : require(id),
      module,
      module.exports
    );
    return module.exports;
  }
  const result = load(
    path.join(root, 'packages/app/fixtures/scrollSeededSession.ts')
  ).assessSeededSession(raw);
  if (
    !declaration ||
    !isDeepStrictEqual(declaration, {
      plan: raw.plan,
      session: raw.session,
      initialRows: raw.initialRows,
      pendingPlan: raw.pendingPlan,
    })
  ) {
    result.issues.push({
      code: 'independent-pre-action-declaration-mismatch',
      kind: 'incomplete',
    });
    if (result.behaviorVerdict !== 'FAIL')
      result.behaviorVerdict = 'INCOMPLETE';
  }
  return { version: 1, ...result, sourceHashes };
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const [input, declarationPath, output] = process.argv.slice(2);
  if (!input || !declarationPath || !output)
    throw Error(
      'Usage: node scripts/scroll-stability-seeded-session-replay.mjs raw.json pre-action-plan.json report.json'
    );
  const bytes = fs.readFileSync(input);
  const declarationBytes = fs.readFileSync(declarationPath);
  const report = {
    input: path.resolve(input),
    inputSha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    declaration: path.resolve(declarationPath),
    declarationSha256: crypto
      .createHash('sha256')
      .update(declarationBytes)
      .digest('hex'),
    ...replaySeededSession(JSON.parse(bytes), JSON.parse(declarationBytes)),
  };
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  process.stdout.write(
    JSON.stringify({
      verdict: report.verdict,
      behaviorVerdict: report.behaviorVerdict,
      issues: report.issues.length,
      presentation: report.presentation,
      soak: report.soak,
    }) + '\n'
  );
}
