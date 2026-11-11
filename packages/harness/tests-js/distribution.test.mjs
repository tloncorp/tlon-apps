// Test the assembled artifact, not the development mount: leftover files can
// hide missing dependencies. Run `just build` before this suite.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { access, readFile, readdir } from 'node:fs/promises'

const desk = new URL('../desk-out/', import.meta.url)
test('the optional JS executor bundles the expected QuickJS binary', async () => {
  const wasm = await readFile(new URL('quick-js-emcc.wasm', desk))
  assert.equal(createHash('sha256').update(wasm).digest('hex'), 'aa83708e03d77e610a576da47eb77ea4b3e0483c88bf9367ed66dc66810f8423')
  for (const name of ['lib/thread-builder-js.hoon', 'lib/wasm/lia.hoon', 'lib/wasm/parser.hoon', 'lib/wasm/runner/engine.hoon', 'sur/wasm/lia.hoon', 'sur/spider.hoon', 'mar/wasm.hoon']) await access(new URL(name, desk))
})
test('Context Lens includes the versioned Steward protocol, not another agent', async () => {
  await access(new URL('sur/steward/lens.hoon', desk))
  await access(new URL('lib/harness-tlon-lens.hoon', desk))
  await access(new URL('lib/harness-run-report.hoon', desk))
  await access(new URL('mar/steward/lens/action-1.hoon', desk))
  await access(new URL('mar/steward/lens/update-1.hoon', desk))
})
test('the distribution declares only the three Harness agents', async () => {
  const bill = await readFile(new URL('desk.bill', desk), 'utf8')
  const agents = [...bill.matchAll(/%([a-z-]+)/g)].map((m) => m[1]).sort()
  assert.deepEqual(agents, ['acp', 'harness', 'harness-tlon'])
  assert.deepEqual((await readdir(new URL('app/', desk))).filter((p) => p.endsWith('.hoon')).sort(), agents.map((a) => `${a}.hoon`).sort())
})
test('agent Ford file imports exist without development-mount leftovers', async () => {
  for (const file of await readdir(new URL('app/', desk), { recursive: true })) {
    if (!file.endsWith('.hoon')) continue
    const source = await readFile(new URL(`app/${file}`, desk), 'utf8')
    for (const [, path] of source.matchAll(/^\/=\s+\S+\s+\/([^\s]+)\s*$/gm)) {
      assert.ok(!path.startsWith('tests/'), `${file} imports a development test: ${path}`)
      await assert.doesNotReject(access(new URL(`${path}.hoon`, desk)), `${file} imports a missing file: ${path}`)
    }
  }
})
test('the distribution includes exactly its own tests', async () => {
  const shipped = (await readdir(new URL('tests/', desk))).sort()
  const own = (await readdir(new URL('../desk/tests/', import.meta.url))).sort()
  assert.deepEqual(shipped, own)
})
test('the default distribution excludes disk-intensive integration tests', async () => {
  await assert.rejects(access(new URL('tests-integration/', desk)), { code: 'ENOENT' })
})
// Ford resolves a hyphenated name to a file or to a nested path.
const candidates = (kind, name) => {
  let paths = ['']
  for (const [index, part] of name.split('-').entries()) {
    paths = index ? paths.flatMap((path) => [`${path}-${part}`, `${path}/${part}`]) : [part]
  }
  return paths.map((path) => `${kind}/${path}.hoon`)
}
test('every structure and library import in the desk resolves to a file', async () => {
  const files = new Set(await readdir(desk, { recursive: true }))
  for (const file of files) {
    if (!file.endsWith('.hoon')) continue
    const lines = (await readFile(new URL(file, desk), 'utf8')).split('\n')
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(/^\/([+-])  (.+)$/)
      if (!match) continue
      let list = match[2].split('::')[0]
      while (/^    [^\s:]/.test(lines[i + 1] || '')) list += ` ${lines[++i].split('::')[0].trim()}`
      for (const token of list.split(/[, ]+/).filter(Boolean)) {
        const name = token.split('=').at(-1).replace(/^\*/, '')
        const found = candidates(match[1] === '-' ? 'sur' : 'lib', name).some((path) => files.has(path))
        assert.ok(found, `${file} imports a missing file: ${name}`)
      }
    }
  }
})
test('fetched dependencies do not shadow the desk\'s own files', async () => {
  const fetched = new URL('../desk-deps/', import.meta.url)
  for (const file of await readdir(fetched, { recursive: true })) {
    if (!file.endsWith('.hoon')) continue
    await assert.rejects(access(new URL(`../desk/${file}`, import.meta.url)), `${file} is both fetched and tracked`)
  }
})
