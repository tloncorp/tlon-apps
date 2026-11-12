import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile, readdir } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { text as readText } from 'node:stream/consumers'

test('fixture request decoding preserves UTF-8 across every byte boundary', async () => {
  const expected = JSON.stringify({ body: 'Austin: café, 東京, 🌦️' })
  const bytes = Buffer.from(expected)
  for (let split = 0; split <= bytes.length; split++) {
    const chunks = [bytes.subarray(0, split), bytes.subarray(split)]
    assert.equal(await readText(Readable.from(chunks)), expected, `Byte split ${split}`)
    const bounded = Readable.from(chunks).setEncoding('utf8')
    let text = ''
    for await (const chunk of bounded) text += chunk
    assert.equal(text, expected, `Bounded fixture byte split ${split}`)
  }
})

test('an 8000-byte Unicode tool page stays exact when request chunks split characters', async () => {
  const body = 'é'.repeat(4000)
  const expected = JSON.stringify({ messages: [{ role: 'tool', content: JSON.stringify({ body }) }] })
  const bytes = Buffer.from(expected)
  const chunks = Array.from(bytes, byte => Buffer.from([byte]))
  const request = JSON.parse(await readText(Readable.from(chunks)))
  const received = JSON.parse(request.messages[0].content).body
  assert.equal(Buffer.byteLength(received), 8000)
  assert.equal(received, body)
})

test('fixture servers use streaming text decoding rather than implicit per-buffer conversion', async () => {
  const root = new URL('./', import.meta.url)
  for (const name of await readdir(root)) {
    if (!name.endsWith('.mjs') || name.endsWith('.test.mjs')) continue
    const source = await readFile(new URL(name, root), 'utf8')
    assert.doesNotMatch(source, /for await \(const (\w+) of (?:req|request)\) \w+ \+= \1/, name)
    if (/await readText\((?:req|request)\)/.test(source)) {
      assert.match(source, /import \{ text as readText \} from 'node:stream\/consumers'/, name)
    }
  }
  const bounded = await readFile(new URL('lib/reliability-fixture.mjs', root), 'utf8')
  assert.match(bounded, /req.setEncoding\('utf8'\)/)
  assert.ok(bounded.indexOf("req.setEncoding('utf8')") < bounded.indexOf('for await'), 'The bounded reader decodes incrementally before collecting text')
  assert.match(bounded, /Buffer.byteLength\(raw\) <= 4 \* 1024 \* 1024/, 'The bounded reader retains its byte limit')
})
