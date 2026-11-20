import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, stat, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { RunnerJournal } from './runner-journal.mjs'

test('runner journal preserves a pending delivery and execution claim across restart', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'harness-runner-journal-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const path = join(directory, 'runner.json')
  const first = await RunnerJournal.open(path, 'identity')
  await first.change(data => { data.cursor = 1; data.attempts.attempt = { status: 'running', event: { attemptId: 'attempt' } }; data.outbox = { sequence: 1, type: 'complete' } })
  await assert.rejects(RunnerJournal.open(path, 'identity'), /locked/)
  assert.equal((await stat(path)).mode & 0o077, 0)
  await first.close()
  const second = await RunnerJournal.open(path, 'identity')
  assert.equal(second.data.cursor, 1)
  assert.equal(second.data.attempts.attempt.status, 'running')
  assert.equal(second.data.outbox.type, 'complete')
  await second.close()
  await assert.rejects(RunnerJournal.open(path, 'different'), /does not match/)
  assert.equal(JSON.parse(await readFile(path)).attempts.attempt.status, 'running')
})
