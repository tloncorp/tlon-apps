const { createHash } = require('node:crypto');
const {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} = require('node:fs');
const { dirname, isAbsolute, join, relative, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');

const assetHash = (value) => createHash('sha256').update(value).digest('hex');
const hashJson = (value) => assetHash(JSON.stringify(value));
const hex = (value) =>
  typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const safePath = (value) =>
  typeof value === 'string' &&
  value.length > 0 &&
  !value.startsWith('/') &&
  !value.split('/').some((p) => p === '..' || p === '.' || !p);
const sourcePath = (path) =>
  (/^(?:apps\/tlon-web\/|packages\/)/.test(path) &&
    !/(?:^|\/)(?:dist|node_modules|test-results|playwright-report)\//.test(
      path
    )) ||
  /^(?:package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|\.npmrc|babel\.config\.[cm]?js|scripts\/scroll-stability-web-assets\.[cm]js)$/.test(
    path
  );
const command = (root, args) => {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (result.status !== 0)
    throw new Error(`Cannot read Git source manifest: ${result.stderr}`);
  return result.stdout;
};
function snapshotWebSources(root) {
  root = realpathSync(root);
  const listed = command(root, [
    'ls-files',
    '-z',
    '--cached',
    '--others',
    '--exclude-standard',
  ])
    .split('\0')
    .filter(sourcePath);
  const envFiles = readdirSync(join(root, 'apps/tlon-web'))
    .filter((name) => /^\.env(?:\.|$)/.test(name))
    .map((name) => `apps/tlon-web/${name}`);
  const paths = [...new Set([...listed, ...envFiles])].sort();
  const workspaceLinks = [];
  for (const folder of ['ui', 'app', 'api', 'shared']) {
    const expected = realpathSync(join(root, 'packages', folder));
    const name = JSON.parse(
      readFileSync(join(expected, 'package.json'), 'utf8')
    ).name;
    for (const base of ['', 'apps/tlon-web', 'packages/app', 'packages/ui']) {
      const path = join(base, 'node_modules', name),
        absolute = join(root, path);
      if (!existsSync(absolute)) {
        if (base === 'apps/tlon-web')
          throw new Error(`Missing workspace package ${path}`);
        continue;
      }
      if (realpathSync(absolute) !== expected)
        throw new Error(
          `Workspace package resolves outside this checkout: ${path}`
        );
      workspaceLinks.push({
        path: path.replaceAll('\\', '/'),
        target: `packages/${folder}`,
      });
    }
  }
  const files = paths.map((path) => {
    const full = join(root, path);
    if (!existsSync(full)) return { path, missing: true };
    const stat = lstatSync(full);
    if (!stat.isFile() && !stat.isSymbolicLink())
      throw new Error(`Unsupported source input ${path}`);
    const body = readFileSync(full);
    return { path, bytes: body.length, sha256: assetHash(body) };
  });
  return {
    root,
    head: command(root, ['rev-parse', 'HEAD']).trim(),
    files,
    workspaceLinks,
    digest: hashJson(files),
  };
}
function outputManifest(root) {
  const files = [];
  function walk(dir) {
    for (const name of readdirSync(dir).sort()) {
      const path = join(dir, name),
        stat = lstatSync(path);
      if (stat.isSymbolicLink())
        throw new Error('Build outputs must not be symlinks');
      if (stat.isDirectory()) walk(path);
      else {
        const body = readFileSync(path);
        files.push({
          path: relative(root, path).replaceAll('\\', '/'),
          bytes: body.length,
          sha256: assetHash(body),
        });
      }
    }
  }
  walk(root);
  return files.sort((a, b) => a.path.localeCompare(b.path));
}
function assessBuildReceipt(receipt) {
  const errors = [];
  if (
    !receipt ||
    receipt.version !== 1 ||
    receipt.kind !== 'vite-production-build'
  )
    return ['Missing production build receipt'];
  const { digest, ...payload } = receipt;
  if (!hex(digest) || hashJson(payload) !== digest)
    errors.push('Build receipt digest mismatch');
  const inputs = receipt.source?.files,
    outputs = receipt.output?.files;
  for (const [name, files] of [
    ['source', inputs],
    ['output', outputs],
  ]) {
    if (
      !Array.isArray(files) ||
      files.length === 0 ||
      new Set(files.map((f) => f?.path)).size !== files.length ||
      files.some(
        (f) =>
          !safePath(f?.path) ||
          (!f.missing &&
            (!hex(f.sha256) || !Number.isInteger(f.bytes) || f.bytes < 0))
      )
    )
      errors.push(`Invalid ${name} file manifest`);
  }
  if (
    !Array.isArray(inputs) ||
    hashJson(inputs) !== receipt.source?.digest ||
    receipt.source?.digest !== receipt.sourceAfterDigest ||
    !/^[a-f0-9]{40}$/.test(receipt.source?.head ?? '')
  )
    errors.push('Source snapshot is missing or changed during build');
  if (
    !Array.isArray(outputs) ||
    hashJson(outputs) !== receipt.output?.digest ||
    !outputs.some((f) => f.path === 'index.html') ||
    !outputs.some((f) => /^assets\/.+-[a-zA-Z0-9_-]+\.js$/.test(f.path))
  )
    errors.push('Missing bundled production outputs');
  if (
    !Array.isArray(receipt.source?.workspaceLinks) ||
    ['ui', 'app', 'api', 'shared'].some(
      (folder) =>
        !receipt.source.workspaceLinks.some(
          (link) =>
            link.path === `apps/tlon-web/node_modules/@tloncorp/${folder}` &&
            link.target === `packages/${folder}`
        )
    ) ||
    receipt.source.workspaceLinks.some(
      (link) =>
        !safePath(link.path) ||
        !/^packages\/(ui|app|api|shared)$/.test(link.target)
    )
  )
    errors.push('Missing canonical workspace package resolution');
  const script = receipt.build?.script;
  if (
    !Array.isArray(receipt.build?.environment) ||
    receipt.build.environment.some(
      (item) => typeof item.name !== 'string' || !hex(item.sha256)
    ) ||
    script !== 'vite build' ||
    receipt.build?.package !== 'tlon-web' ||
    receipt.build?.scriptSha256 !== assetHash(script ?? '') ||
    receipt.build?.exitCode !== 0 ||
    !Array.isArray(receipt.build?.argv) ||
    JSON.stringify(receipt.build.argv) !==
      JSON.stringify([
        'corepack',
        'pnpm',
        '--filter',
        'tlon-web',
        'build',
        '--outDir',
        receipt.output?.root,
      ]) ||
    !Number.isFinite(receipt.build?.startedAt) ||
    !(receipt.build?.completedAt >= receipt.build.startedAt) ||
    !hex(receipt.build?.packageJsonSha256) ||
    inputs?.find((f) => f.path === 'apps/tlon-web/package.json')?.sha256 !==
      receipt.build.packageJsonSha256
  )
    errors.push('Missing exact current build script execution');
  if (
    !isAbsolute(receipt.source?.root ?? '') ||
    !isAbsolute(receipt.output?.root ?? '')
  )
    errors.push('Missing absolute build roots');
  return errors;
}
function verifyCurrentWebBuild(receipt, root) {
  const errors = assessBuildReceipt(receipt);
  if (errors.length) throw new Error(errors.join('; '));
  const current = snapshotWebSources(root);
  if (
    current.root !== receipt.source.root ||
    current.head !== receipt.source.head ||
    current.digest !== receipt.source.digest
  )
    throw new Error(
      'Current workspace differs from production build source receipt'
    );
  if (hashJson(outputManifest(receipt.output.root)) !== receipt.output.digest)
    throw new Error('Production output files changed after build');
  const pkg = JSON.parse(
    readFileSync(join(root, 'apps/tlon-web/package.json'), 'utf8')
  );
  if (pkg.scripts.build !== receipt.build.script)
    throw new Error('Current package build script differs');
  return {
    checkedAt: Date.now(),
    sourceDigest: current.digest,
    outputDigest: receipt.output.digest,
  };
}
function assessProductionAssets(proof, expected = {}) {
  const issues = [];
  const reject = (message) =>
    issues.push({ kind: 'incomplete', message: `Web assets: ${message}` });
  try {
    for (const message of assessBuildReceipt(proof?.receipt)) reject(message);
    if (issues.length) return issues;
    const { receipt } = proof,
      start = Date.parse(expected.attemptStartTime),
      finish =
        expected.attemptWallEndTime ?? start + expected.attemptDurationMs;
    if (
      proof.version !== 1 ||
      proof.kind !== 'served-production-assets' ||
      proof.origin !== 'http://localhost:3000' ||
      (expected.origin && proof.origin !== expected.origin) ||
      (expected.scope && proof.scope !== expected.scope) ||
      !Number.isFinite(proof.startedAt) ||
      !Number.isFinite(proof.completedAt) ||
      proof.startedAt < receipt.build.completedAt ||
      proof.completedAt < proof.startedAt ||
      !Number.isFinite(start) ||
      expected.attemptClockError ||
      !Number.isFinite(finish) ||
      finish < start + expected.attemptDurationMs ||
      !(expected.attemptDurationMs > 0) ||
      proof.startedAt < start ||
      proof.completedAt > finish
    )
      reject('Build/load observation is not scoped to this attempt');
    if (
      proof.currentCheck?.sourceDigest !== receipt.source.digest ||
      proof.currentCheck?.outputDigest !== receipt.output.digest ||
      !Number.isFinite(proof.currentCheck?.checkedAt) ||
      proof.currentCheck.checkedAt > proof.startedAt ||
      proof.currentCheck.checkedAt < receipt.build.completedAt
    )
      reject('Missing current workspace/output comparison');
    if (
      !Number.isFinite(proof.timeOrigin) ||
      !Number.isFinite(proof.performanceEnd) ||
      Math.abs(proof.timeOrigin + proof.performanceEnd - proof.completedAt) >
        100 ||
      (Number.isFinite(expected.performanceEndTime) &&
        proof.performanceEnd < expected.performanceEndTime)
    )
      reject('Asset observation does not cover the content capture');
    if (
      !Array.isArray(proof.errors) ||
      proof.errors.length ||
      !Array.isArray(proof.responses) ||
      !proof.responses.length ||
      !Array.isArray(proof.resources) ||
      !Array.isArray(proof.scripts) ||
      !proof.scripts.length ||
      proof.vitePreamble !== false
    )
      reject('Missing complete browser response/runtime inventory');
    const dev =
      /(?:\/@(?:vite|fs|id)\/|\/src\/|\/node_modules\/|@react-refresh)/;
    const urls = [
      ...(proof.resources ?? []).map((r) => r.url),
      ...(proof.scripts ?? []),
      ...(proof.responses ?? []).map((r) => r.url),
    ];
    if (urls.some((url) => typeof url !== 'string' || dev.test(url)))
      reject('Development runtime contamination');
    const files = new Map(
      receipt.output.files.map((file) => [file.path, file])
    );
    const toPath = (url) => {
      const u = new URL(url);
      return u.origin === proof.origin && u.pathname.startsWith('/apps/groups/')
        ? decodeURIComponent(u.pathname.slice('/apps/groups/'.length))
        : null;
    };
    const bootstrapPaths = ['/apps/groups/desk.js', '/session.js'];
    let documents = 0,
      bundled = 0;
    for (const response of proof.responses ?? []) {
      const url = new URL(response.url);
      if (
        bootstrapPaths.includes(url.pathname) &&
        url.origin === proof.origin &&
        !url.search
      ) {
        if (
          response.type !== 'script' ||
          response.status !== 200 ||
          !hex(response.sha256) ||
          !(response.bytes > 0) ||
          !Number.isFinite(response.observedAt) ||
          response.observedAt < proof.startedAt ||
          response.observedAt > proof.completedAt ||
          typeof response.fromServiceWorker !== 'boolean'
        )
          reject('Invalid ship bootstrap response observation');
        continue;
      }
      const path =
          response.type === 'document' ? 'index.html' : toPath(response.url),
        file = files.get(path);
      if (response.type === 'document') documents++;
      if (/^assets\/.+\.js$/.test(path ?? '')) bundled++;
      if (
        new URL(response.url).origin !== proof.origin ||
        !new URL(response.url).pathname.startsWith('/apps/groups/') ||
        !file ||
        response.status !== 200 ||
        response.sha256 !== file.sha256 ||
        response.bytes !== file.bytes ||
        !Number.isFinite(response.observedAt) ||
        response.observedAt < proof.startedAt ||
        response.observedAt > proof.completedAt ||
        typeof response.fromServiceWorker !== 'boolean'
      )
        reject('Observed browser response does not match built bytes');
    }
    const executable = (resource) =>
      resource.initiatorType === 'script' ||
      /\.(?:js|css|wasm)(?:\?|$)/.test(resource.url);
    const required = [
      ...proof.scripts,
      ...proof.resources.filter(executable).map((r) => r.url),
    ];
    if (
      bootstrapPaths.some(
        (path) =>
          !proof.scripts.includes(proof.origin + path) ||
          !proof.responses.some(
            (r) => r.url === proof.origin + path && r.type === 'script'
          )
      ) ||
      documents !== 1 ||
      bundled < 1 ||
      required.length < 1 ||
      required.some(
        (url) =>
          !proof.responses.some((r) => r.url === url && r.type !== 'document')
      )
    )
      reject('Missing actual loaded document or executable/style response');
  } catch {
    reject('Malformed production asset proof');
  }
  return issues;
}

function buildWebReceipt({ root, output, receiptPath }) {
  root = realpathSync(root);
  output = resolve(output);
  receiptPath = resolve(receiptPath);
  if (existsSync(output) && readdirSync(output).length)
    throw new Error('Refusing nonempty production output directory');
  if (existsSync(receiptPath))
    throw new Error('Refusing existing production receipt');
  mkdirSync(output, { recursive: true });
  const source = snapshotWebSources(root),
    packageBody = readFileSync(join(root, 'apps/tlon-web/package.json'));
  const script = JSON.parse(packageBody).scripts.build;
  if (script !== 'vite build')
    throw new Error(
      'Unexpected build script; update the explicit contract first'
    );
  const argv = [
      'corepack',
      'pnpm',
      '--filter',
      'tlon-web',
      'build',
      '--outDir',
      output,
    ],
    startedAt = Date.now();
  const environment = Object.entries({ ...process.env, CI: 'false' })
    .filter(([name]) =>
      /^(?:VITE_|TAMAGUI_|SHIP_URL|NODE_ENV$|CI$|SSL$)/.test(name)
    )
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => ({ name, sha256: assetHash(value ?? '') }));
  const result = spawnSync(argv[0], argv.slice(1), {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, CI: 'false' },
  });
  const completedAt = Date.now(),
    after = snapshotWebSources(root);
  if (result.status !== 0)
    throw new Error(`Production build exited ${result.status}`);
  if (after.digest !== source.digest || after.head !== source.head)
    throw new Error('Source changed during production build');
  const files = outputManifest(output);
  const payload = {
    version: 1,
    kind: 'vite-production-build',
    source,
    sourceAfterDigest: after.digest,
    build: {
      environment,
      package: 'tlon-web',
      script,
      scriptSha256: assetHash(script),
      packageJsonSha256: assetHash(packageBody),
      argv,
      startedAt,
      completedAt,
      exitCode: result.status,
    },
    output: { root: output, files, digest: hashJson(files) },
  };
  const receipt = { ...payload, digest: hashJson(payload) };
  const errors = assessBuildReceipt(receipt);
  if (errors.length) throw new Error(errors.join('; '));
  mkdirSync(dirname(receiptPath), { recursive: true });
  writeFileSync(receiptPath, JSON.stringify(receipt, null, 2));
  return receipt;
}
module.exports = {
  assetHash,
  snapshotWebSources,
  outputManifest,
  assessBuildReceipt,
  verifyCurrentWebBuild,
  assessProductionAssets,
  buildWebReceipt,
};
