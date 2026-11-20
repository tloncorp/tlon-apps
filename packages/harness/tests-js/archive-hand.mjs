// Seal a disabled, settled hand binding only after writing its complete export.
// SHIP_COOKIE=/path/to/cookie node tests-js/archive-hand.mjs BINDING OUTPUT.jsonl
import { open } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { Client } from './lib/ship-client.mjs'
import { HandClient } from '../acp/hand-client.mjs'

const [binding, output] = process.argv.slice(2)
if (!binding || !output) throw new Error('Usage: archive-hand.mjs BINDING OUTPUT.jsonl (binding must be disabled and settled)')
const client = new Client()
const hand = new HandClient(client, { hand: 'owner-archive', worker: 'owner-archive' })
let file
try {
  await client.start()
  const archive = await hand.archive(binding)
  const path = resolve(output)
  file = await open(path, 'wx', 0o600) // Never overwrite an existing archive.
  await file.writeFile(`${JSON.stringify({ format: 'harness-hand-archive-2', ...archive })}\n`)
  let after = null, count = 0
  do {
    const page = await hand.records(binding, after)
    if (page.digest !== archive.digest) throw new Error('Binding changed during export; nothing retired')
    for (const record of page.records) {
      await file.writeFile(`${JSON.stringify(record)}\n`)
      count++
    }
    after = page.next
  } while (after)
  if (count !== archive.records) throw new Error('Incomplete export; nothing retired')
  await file.writeFile(`${JSON.stringify({ complete: true, digest: archive.digest, records: count })}\n`)
  await file.sync()
  await file.close(); file = null
  const dir = await open(dirname(path), 'r')
  try { await dir.sync() } finally { await dir.close() }
  await hand.retire(binding, archive.digest, path)
  console.log(`Archived ${count} observations to ${path}; retired ${binding}. Session retained.`)
} finally {
  await file?.close()
  await client.close()
}
