// An observable local effect, not an external service. Counts BEFORE replying
// so disconnect/cancel tests cannot confuse a lost receipt with an absent write.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'

export const faultModes = ['normal', 'watch-loss', 'client-detach', 'provider-failure', 'cancel-after-effect', 'revoke-before-dispatch']

export async function fixture() {
  const records = new Map(), failures = []
  let base, totalEffects = 0, totalRequests = 0
  const fail = (error) => { if (failures.length < 16) failures.push(error) }
  const reply = (res, message, tool = false) => {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ choices: [{ finish_reason: tool ? 'tool_calls' : 'stop', message }], usage: { prompt_tokens: 1, completion_tokens: 1 } }))
  }
  const server = createServer(async (req, res) => {
    try {
      req.setEncoding('utf8')
      let raw = ''
      for await (const chunk of req) {
        raw += chunk
        assert.ok(Buffer.byteLength(raw) <= 4 * 1024 * 1024, 'Fixture request exceeds 4 MiB; stop history growth')
      }
      if (req.url === '/effect') {
        assert.equal(req.method, 'POST')
        const record = records.get(raw)
        assert.ok(record, 'Unexpected or late effect token')
        record.effects++; totalEffects++
        assert.equal(record.effects, 1, 'A local effect was executed twice')
        record.effectAt = performance.now()
        record.releaseEffect = () => res.end(`EFFECT_${raw}`)
        if (!['watch-loss', 'client-detach', 'cancel-after-effect'].includes(record.mode)) record.releaseEffect()
        return
      }
      assert.equal(req.url, '/model')
      const body = JSON.parse(raw)
      const last = body.messages.findLastIndex((m) => m.role === 'user')
      const content = body.messages[last]?.content
      const token = (typeof content === 'string' ? content : content?.map((p) => p.text || '').join('')).trim()
      const record = records.get(token)
      assert.ok(record, 'Unexpected model turn (including any automatic compaction)')
      totalRequests++; record.modelRequests++
      record.requestBytes = Buffer.byteLength(raw)
      const result = body.messages.slice(last + 1).find((m) => m.role === 'tool')
      if (result) {
        record.receipt = result.content
        if (record.mode === 'revoke-before-dispatch') assert.match(result.content, /error|reject|permission|denied/i)
        else assert.ok(result.content.includes(`EFFECT_${token}`), 'Model continuation must receive the actual effect receipt')
        return reply(res, { role: 'assistant', content: `DONE_${token}` })
      }
      assert.equal(record.modelRequests, 1, 'Initial provider request was repeated')
      record.modelAt = performance.now()
      if (record.mode === 'provider-failure') { res.writeHead(503); res.end('SYNTHETIC_PROVIDER_UNAVAILABLE'); return }
      const response = { role: 'assistant', content: '', tool_calls: [{ id: token, type: 'function', function: {
        name: 'curl', arguments: JSON.stringify({ url: `${base}/effect`, method: 'POST', body: token }),
      } }] }
      record.releaseModel = () => reply(res, response, true)
      if (record.mode !== 'revoke-before-dispatch') record.releaseModel()
    } catch (error) {
      fail(error)
      if (!res.headersSent) res.writeHead(500)
      res.end('LOCAL_FIXTURE_FAILURE')
    }
  })
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  base = `http://127.0.0.1:${server.address().port}`
  return {
    base, failures,
    begin(token, mode) {
      assert.ok(faultModes.includes(mode) && !records.has(token) && records.size < 8)
      const record = { token, mode, effects: 0, modelRequests: 0 }
      records.set(token, record)
      return record
    },
    end(token) { records.delete(token) },
    counts() { return { effects: totalEffects, modelRequests: totalRequests, retainedRecords: records.size } },
    async close() {
      server.closeAllConnections()
      await new Promise((resolve) => server.close(resolve))
    },
  }
}
