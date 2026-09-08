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
const legacySourcePath = (path) =>
  (/^(?:apps\/tlon-web\/|packages\/)/.test(path) &&
    !/(?:^|\/)(?:dist|node_modules|test-results|playwright-report)\//.test(
      path
    )) ||
  /^(?:package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|\.npmrc|babel\.config\.[cm]?js|scripts\/scroll-stability-web-assets\.[cm]js)$/.test(
    path
  );
const TEST_INPUT_POLICY = 'existing-e2e-and-readers-v1';
const testOnlyPath = (path) =>
  /^apps\/tlon-web\/e2e\/.+\.(?:[cm]?[jt]sx?)$/.test(path) ||
  /^apps\/tlon-web\/playwright(?:\.[a-z0-9-]+)*\.config\.[cm]?[jt]s$/.test(
    path
  ) ||
  /^scripts\/run-scroll-stability-web\.mjs$/.test(path) ||
  (/^scripts\/scroll-stability-.+\.(?:mjs|cjs)$/.test(path) &&
    !/^scripts\/scroll-stability-web-assets\.(?:mjs|cjs)$/.test(path));

const sourcePath = (path) =>
  legacySourcePath(path) ||
  /^[^/]+$/.test(path) ||
  /^(?:patches|scripts)\//.test(path);
function sourceIdentities(files) {
  const testFiles = files.filter((f) => testOnlyPath(f.path));
  const runtimeFiles = files.filter((f) => !testOnlyPath(f.path));
  // File-set/ownership changes require a rebuild, even inside the test-only lane.
  const testPaths = testFiles.map((f) => ({
    path: f.path,
    missing: f.missing === true,
  }));
  return {
    policy: TEST_INPUT_POLICY,
    runtimeDigest: hashJson({ runtimeFiles, testPaths }),
    testDigest: hashJson(testFiles),
    testFiles,
  };
}
function buildEnvironment() {
  return Object.entries({
    ...process.env,
    CI: 'false',
    SCROLLER_WEB_BUILD_RECEIPT_GUARD: '1',
  })
    .filter(([name]) =>
      /^(?:VITE_|TAMAGUI_|SHIP_URL|NODE_ENV$|CI$|SSL$|SCROLLER_WEB_BUILD_RECEIPT_GUARD$)/.test(
        name
      )
    )
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => ({ name, sha256: assetHash(value ?? '') }));
}
function createWebTestIsolationPlugin(root, scope) {
  root = realpathSync(root);
  if (!['main', 'worker'].includes(scope))
    throw Error('Unknown build isolation scope');
  let configChecked = false;
  const check = (id) => {
    if (typeof id !== 'string') throw Error('Unknown build module identity');
    if (id.startsWith('\0')) return; // Virtual IDs cannot be test-file owners.
    // Vite 5's production browser shim is a virtual empty module, not a path.
    if (id === '__vite-browser-external') return;
    const path = id.split('?')[0];
    if (!isAbsolute(path)) throw Error(`Unknown build module path: ${id}`);
    const relativePath = relative(
      root,
      existsSync(path) ? realpathSync(path) : path
    ).replaceAll('\\', '/');
    if (testOnlyPath(relativePath))
      throw Error(`Production build imports test-only input: ${relativePath}`);
  };
  return {
    name: `scroller-test-isolation-${scope}-v1`,
    enforce: 'pre',
    configResolved(config) {
      if (!Array.isArray(config.configFileDependencies))
        throw Error('Missing Vite configuration dependency identity');
      config.configFileDependencies.forEach(check);
      configChecked = true;
    },
    transform(_code, id) {
      check(id);
      return null;
    },
    generateBundle() {
      if (!configChecked) throw Error('Missing build configuration isolation');
      const ids = [...this.getModuleIds()];
      ids.forEach((id) => {
        if (isAbsolute(id) || !this.getModuleInfo(id)?.isExternal) check(id);
      });
      const payload = {
        version: 1,
        policy: TEST_INPUT_POLICY,
        scope,
        root,
        moduleCount: ids.length,
      };
      if (!payload.moduleCount) throw Error('Empty build module inventory');
      this.emitFile({
        type: 'asset',
        fileName: `scroller-build-isolation-${scope}.json`,
        source: JSON.stringify(payload),
      });
    },
  };
}
const command = (root, args) => {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (result.status !== 0)
    throw new Error(`Cannot read Git source manifest: ${result.stderr}`);
  return result.stdout;
};
function snapshotWebSources(root, options = {}) {
  root = realpathSync(root);
  const listed = command(root, [
    'ls-files',
    '-z',
    '--cached',
    '--others',
    '--exclude-standard',
  ])
    .split('\0')
    .filter(options.version === 1 ? legacySourcePath : sourcePath);
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
    const resolved = realpathSync(full);
    const indirect = stat.isSymbolicLink() || resolved !== resolve(root, path);
    if (
      options.version !== 1 &&
      indirect &&
      (testOnlyPath(path) || !resolved.startsWith(root + '/'))
    )
      throw new Error(
        `Source symlink cannot certify isolated build input ${path}`
      );
    if (!stat.isFile() && !stat.isSymbolicLink())
      throw new Error(`Unsupported source input ${path}`);
    const body = readFileSync(full);
    return {
      path,
      bytes: body.length,
      sha256: assetHash(body),
      ...(options.version !== 1 && indirect
        ? { resolvedPath: relative(root, resolved).replaceAll('\\', '/') }
        : {}),
    };
  });
  return {
    root,
    head: command(root, ['rev-parse', 'HEAD']).trim(),
    files,
    workspaceLinks,
    digest: hashJson(files),
    ...(options.version === 1 ? {} : { identity: sourceIdentities(files) }),
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
    ![1, 2].includes(receipt.version) ||
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
  if (receipt.version === 2) {
    if (
      !Array.isArray(inputs) ||
      inputs.some(
        (f) =>
          (f.missing !== undefined && f.missing !== true) ||
          (f.resolvedPath !== undefined &&
            (!safePath(f.resolvedPath) || testOnlyPath(f.path)))
      ) ||
      JSON.stringify(receipt.source?.identity) !==
        JSON.stringify(sourceIdentities(inputs))
    )
      errors.push('Invalid runtime/test source identities');
    if (
      !receipt.build?.environment?.some(
        (e) =>
          e.name === 'SCROLLER_WEB_BUILD_RECEIPT_GUARD' &&
          e.sha256 === assetHash('1')
      )
    )
      errors.push('Missing receipt build isolation flag');
    for (const scope of ['main', 'worker']) {
      const guard = receipt.isolation?.[scope];
      const output = outputs?.find(
        (f) => f.path === `scroller-build-isolation-${scope}.json`
      );
      const body = JSON.stringify(guard);
      if (
        guard?.version !== 1 ||
        guard.policy !== TEST_INPUT_POLICY ||
        guard.scope !== scope ||
        guard.root !== receipt.source.root ||
        !Number.isSafeInteger(guard.moduleCount) ||
        guard.moduleCount < 1 ||
        !output ||
        output.sha256 !== assetHash(body) ||
        output.bytes !== Buffer.byteLength(body)
      )
        errors.push(`Missing actual ${scope} build isolation artifact`);
    }
  }
  return errors;
}
function verifyCurrentWebBuild(receipt, root) {
  const errors = assessBuildReceipt(receipt);
  if (errors.length) throw new Error(errors.join('; '));
  const current = snapshotWebSources(root, { version: receipt.version });
  if (
    current.root !== receipt.source.root ||
    (receipt.version === 1
      ? current.head !== receipt.source.head ||
        current.digest !== receipt.source.digest
      : current.identity.runtimeDigest !==
          receipt.source.identity.runtimeDigest ||
        JSON.stringify(current.workspaceLinks) !==
          JSON.stringify(receipt.source.workspaceLinks))
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
    ...(receipt.version === 2
      ? {
          version: 2,
          root: current.root,
          head: current.head,
          identity: current.identity,
          workspaceLinks: current.workspaceLinks,
        }
      : {}),
  };
}
function validCurrentIdentity(check, receipt) {
  try {
    if (
      check?.version !== 2 ||
      check.root !== receipt.source.root ||
      !/^[a-f0-9]{40}$/.test(check.head ?? '') ||
      JSON.stringify(check.workspaceLinks) !==
        JSON.stringify(receipt.source.workspaceLinks)
    )
      return false;
    const identity = check.identity,
      files = identity?.testFiles;
    if (
      !Array.isArray(files) ||
      files.some(
        (f) =>
          !testOnlyPath(f?.path) ||
          !safePath(f.path) ||
          f.resolvedPath !== undefined ||
          (f.missing !== undefined && f.missing !== true) ||
          (!f.missing &&
            (!hex(f.sha256) || !Number.isInteger(f.bytes) || f.bytes < 0))
      ) ||
      new Set(files.map((f) => f.path)).size !== files.length
    )
      return false;
    const all = [
      ...receipt.source.files.filter((f) => !testOnlyPath(f.path)),
      ...files,
    ].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
    return (
      hashJson(all) === check.sourceDigest &&
      JSON.stringify(sourceIdentities(all)) === JSON.stringify(identity) &&
      identity.runtimeDigest === receipt.source.identity.runtimeDigest
    );
  } catch {
    return false;
  }
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
      // Never compare a Date.now endpoint with accumulated timeout duration.
      finish < start ||
      !Number.isFinite(expected.attemptDurationMs) ||
      !(expected.attemptDurationMs > 0) ||
      proof.startedAt < start ||
      proof.completedAt > finish
    )
      reject('Build/load observation is not scoped to this attempt');
    if (
      (receipt.version === 1
        ? proof.currentCheck?.sourceDigest !== receipt.source.digest
        : !validCurrentIdentity(proof.currentCheck, receipt)) ||
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
  const environment = buildEnvironment();
  const result = spawnSync(argv[0], argv.slice(1), {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, CI: 'false', SCROLLER_WEB_BUILD_RECEIPT_GUARD: '1' },
  });
  const completedAt = Date.now(),
    after = snapshotWebSources(root);
  if (result.status !== 0)
    throw new Error(`Production build exited ${result.status}`);
  if (after.digest !== source.digest || after.head !== source.head)
    throw new Error('Source changed during production build');
  const files = outputManifest(output);
  const payload = {
    version: 2,
    kind: 'vite-production-build',
    source,
    sourceAfterDigest: after.digest,
    isolation: Object.fromEntries(
      ['main', 'worker'].map((scope) => [
        scope,
        JSON.parse(
          readFileSync(
            join(output, `scroller-build-isolation-${scope}.json`),
            'utf8'
          )
        ),
      ])
    ),
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
  createWebTestIsolationPlugin,
  sourceIdentities,
  snapshotWebSources,
  outputManifest,
  assessBuildReceipt,
  verifyCurrentWebBuild,
  assessProductionAssets,
  buildWebReceipt,
};
