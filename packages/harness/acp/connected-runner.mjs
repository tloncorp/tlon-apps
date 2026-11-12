#!/usr/bin/env node
import { createHash, randomBytes } from 'node:crypto'
import { resolve, dirname, join } from 'node:path'
import { realpath, readFile, lstat } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { setTimeout as delay } from 'node:timers/promises'
import { RunnerJournal } from './runner-journal.mjs'
import { readSSE } from './sse.mjs'
import { createProvider, validateAgentOptions } from './local-agent-provider.mjs'

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const identity = event => ({ attemptId: event.attemptId, conversationId: event.conversationId, turnId: event.turnId })
const fatalHTTP = status => status >= 400 && status < 500 && status !== 408 && status !== 429

export function runnerEndpoint(ship, runner) {
  const url = new URL(ship)
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('Use the ship origin without a path, query, or credentials.')
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname))) throw new Error('Runner connections require HTTPS, except on loopback.')
  if (!/^[a-z0-9-]{1,64}$/.test(runner)) throw new Error('Invalid runner ID.')
  return new URL(`/harness/runners/${runner}/events`, url).href
}

export function validateEvent(frame) {
  if (!/^[1-9][0-9]*$/.test(frame.id) || !Number.isSafeInteger(Number(frame.id))) throw new Error('Invalid SSE sequence ID.')
  if (frame.event !== 'harness') throw new Error('Unexpected SSE event type.')
  const event = JSON.parse(frame.data)
  if (event?.version !== 1 || !['prompt', 'cancel'].includes(event.type) || !/^[a-zA-Z0-9][a-zA-Z0-9.-]{0,127}$/.test(event.attemptId) || typeof event.conversationId !== 'string' || !event.conversationId || event.conversationId.length > 512 || typeof event.turnId !== 'string' || !/^[0-9.]+$/.test(event.turnId)) throw new Error('Invalid runner event envelope.')
  if (event.type === 'prompt' && (!event.request || typeof event.request !== 'object' || Array.isArray(event.request))) throw new Error('Prompt has no request.')
  return event
}

export async function createRunner({ ship, runner, key, state, repo, agentType = 'acp', command = agentType === 'codex' ? ['codex', 'app-server'] : ['claude-agent-acp'], model = '', sandbox = 'read-only', allow = [], harnessTools = [], fetchImpl = fetch, providerFactory = createProvider, log = message => process.stderr.write(`${message}\n`), reconnectMs = 1000, heartbeatMs = 15_000 }) {
  const endpoint = runnerEndpoint(ship, runner)
  if (!/^hrr_[a-f0-9]{64}$/.test(key || '')) throw new Error('Supply the dedicated runner key, not a ship login code.')
  if (!state || !repo) throw new Error('--state and --repo are required.')
  validateAgentOptions({ command, agentType, model, sandbox, allow, harnessTools })
  repo = await realpath(repo)
  if (!(await lstat(repo)).isDirectory()) throw new Error('--repo must be a directory.')
  state = resolve(state)
  const journal = await RunnerJournal.open(state, hash({ endpoint, key: hash(key), repo, agentType, command, model, sandbox, allow, harnessTools }))
  const stop = new AbortController()
  const providers = new Map(), executions = new Map()
  let postChain = Promise.resolve(), running, failure, closing, heartbeat, heartbeatPending = false
  const headers = { authorization: `Bearer ${key}` }

  function fail(error) { failure ??= error; stop.abort() }

  async function drain() {
    let backoff = reconnectMs
    while (journal.data.outbox && !stop.signal.aborted) {
      const event = journal.data.outbox
      try {
        const response = await fetchImpl(endpoint, { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify(event), redirect: 'error', signal: AbortSignal.any([stop.signal, AbortSignal.timeout(15_000)]) })
        if (response.ok) {
          const receipt = await response.json()
          await journal.change(data => { data.sequence = event.sequence; data.outbox = null })
          return receipt.message !== 'Inactive attempt; event discarded'
        }
        await response.body?.cancel()
        if (fatalHTTP(response.status)) throw new Error(`Runner POST rejected (${response.status}); inspect the connection and journal.`)
      } catch (error) {
        if (stop.signal.aborted) throw error
        if (!['TypeError', 'TimeoutError'].includes(error.name)) throw error
      }
      await delay(backoff, undefined, { signal: stop.signal })
      backoff = Math.min(backoff * 2, 30_000)
    }
    if (stop.signal.aborted) throw new Error('Runner stopped.')
  }

  function send(event) {
    const next = postChain.then(async () => {
      await drain()
      await journal.change(data => { data.outbox = { ...event, version: 1, sequence: data.sequence + 1 } })
      return await drain()
    })
    postChain = next
    void next.catch(fail)
    return next
  }

  async function providerFor(conversation) {
    if (providers.has(conversation)) return providers.get(conversation)
    if (providers.size >= 16) throw new Error('Runner has 16 loaded conversations; restart after all turns settle.')
    const token = randomBytes(32).toString('hex')
    const ready = providerFactory({ repo, state: join(dirname(state), `${hash({ endpoint, key: hash(key), state, conversation })}.agent.json`), token, command, agentType, model, sandbox, allow, harnessTools, port: 0, log })
      .then(provider => ({ ...provider, token }))
    providers.set(conversation, ready)
    try { return await ready } catch (error) { providers.delete(conversation); throw error }
  }

  async function execute(event, signal) {
    const provider = await providerFor(event.conversationId)
    if (signal.aborted) throw new Error('Attempt cancelled before dispatch.')
    provider.lastAttempt = event.attemptId
    const response = await fetchImpl(`${provider.url}/v1/chat/completions`, {
      method: 'POST', headers: { authorization: `Bearer ${provider.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ ...event.request, model: 'local-acp', stream: true }), signal,
    })
    if (!response.ok) { await response.body?.cancel(); throw new Error(`Local agent rejected the request (${response.status}).`) }
    let text = '', calls = [], finish = null, done = false, delta = ''
    // Coalesce deltas to bound ship events and fsyncs without losing ordering.
    for await (const frame of readSSE(response.body)) {
      if (frame.data === '[DONE]') { done = true; break }
      const value = JSON.parse(frame.data)
      if (value.error) throw new Error('Local agent interrupted; inspect its log.')
      const choice = value.choices?.[0]
      if (!choice) throw new Error('Invalid local completion stream.')
      const content = choice.delta?.content || ''
      text += content; delta += content
      if (Buffer.byteLength(text) > 128 * 1024) throw new Error('Local reply exceeds 128 KiB.')
      if (choice.delta?.tool_calls) calls = choice.delta.tool_calls.map(({ index, ...call }) => call)
      finish = choice.finish_reason || finish
      if (Buffer.byteLength(delta) >= 256 || finish) {
        if (delta) await send({ ...identity(event), type: 'delta', text: delta })
        delta = ''
      }
    }
    if (!done || !['stop', 'tool_calls'].includes(finish)) throw new Error('Incomplete local completion stream.')
    return { choices: [{ index: 0, finish_reason: finish, message: { role: 'assistant', content: text, ...(calls.length ? { tool_calls: calls } : {}) } }] }
  }

  async function settle(event, response) {
    await journal.change(data => { data.attempts[event.attemptId].response = response })
    await send({ ...identity(event), ...(response ? { type: 'complete', response } : { type: 'failed' }) })
    await journal.change(data => { data.attempts[event.attemptId] = { status: 'settled', event: { ...identity(event), type: event.type, version: 1 } } })
  }

  function launch(event) {
    const controller = new AbortController()
    const abort = () => controller.abort()
    stop.signal.addEventListener('abort', abort, { once: true })
    const task = (async () => {
      const claimed = await send({ ...identity(event), type: 'claim' })
      if (!claimed) {
        await journal.change(data => { data.attempts[event.attemptId] = { status: 'cancelled', event: { ...identity(event), version: 1, type: event.type } } })
        return
      }
      await journal.change(data => { data.attempts[event.attemptId].status = 'running' })
      let response
      try { response = await execute(event, controller.signal) } catch (error) {
        log(error.message)
        if (stop.signal.aborted) return
        response = null
      }
      await settle(event, response)
    })().finally(() => { executions.delete(event.attemptId); stop.signal.removeEventListener('abort', abort) })
    executions.set(event.attemptId, { controller, task })
    void task.catch(fail)
  }

  async function receive(frame) {
    const event = validateEvent(frame), sequence = Number(frame.id)
    if (sequence <= journal.data.cursor) return
    if (sequence !== journal.data.cursor + 1) throw new Error('SSE delivery gap; inspect the runner journal.')
    if (event.type === 'cancel') {
      executions.get(event.attemptId)?.controller.abort()
      const loaded = providers.get(event.conversationId)
      if (loaded) {
        const provider = await loaded
        if (provider.lastAttempt === event.attemptId) await fetchImpl(`${provider.url}/cancel`, { method: 'POST', headers: { authorization: `Bearer ${provider.token}` }, signal: AbortSignal.timeout(5000) }).then(response => response.body?.cancel())
      }
      await journal.change(data => { data.cursor = sequence })
    } else {
      if (Object.hasOwn(journal.data.attempts, event.attemptId)) throw new Error('Duplicate attempt identity in a new delivery.')
      await journal.change(data => {
        if (Object.keys(data.attempts).length >= 4096) throw new Error('Runner journal attempt capacity reached; retain it and pair a new runner.')
        data.attempts[event.attemptId] = { status: 'reserved', event }
        data.cursor = sequence
      })
      launch(event)
    }
    await send({ type: 'ack', through: journal.data.cursor })
  }

  async function recover() {
    await drain()
    for (const attempt of Object.values(journal.data.attempts)) {
      if (['reserved', 'running'].includes(attempt.status)) await settle(attempt.event, attempt.response || null)
    }
  }

  async function run() {
    await recover()
    heartbeat = setInterval(() => {
      if (heartbeatPending || stop.signal.aborted) return
      heartbeatPending = true
      void send({ type: 'ack', through: journal.data.cursor }).finally(() => { heartbeatPending = false }).catch(() => {})
    }, heartbeatMs)
    let backoff = reconnectMs
    while (!stop.signal.aborted) {
      const connection = new AbortController()
      const abort = () => connection.abort()
      stop.signal.addEventListener('abort', abort, { once: true })
      let idle = setTimeout(() => connection.abort(), 45_000)
      try {
        const response = await fetchImpl(endpoint, { headers: { ...headers, accept: 'text/event-stream', 'last-event-id': String(journal.data.cursor) }, redirect: 'error', signal: connection.signal })
        if (!response.ok) {
          await response.body?.cancel()
          if (fatalHTTP(response.status)) throw new Error(`Runner SSE rejected (${response.status}); check the key and journal.`)
        } else {
          if (!response.headers.get('content-type')?.startsWith('text/event-stream')) throw new Error('Expected an SSE response.')
          log('Runner connected. Waiting for work.')
          backoff = reconnectMs
          for await (const frame of readSSE(response.body, { onActivity: () => { clearTimeout(idle); idle = setTimeout(() => connection.abort(), 45_000) } })) await receive(frame)
        }
      } catch (error) {
        if (stop.signal.aborted) break
        if (!['TypeError', 'TimeoutError', 'AbortError'].includes(error.name)) throw error
      } finally { clearTimeout(idle); stop.signal.removeEventListener('abort', abort); connection.abort() }
      if (!stop.signal.aborted) {
        log('Runner disconnected. Reconnecting without repeating work.')
        await delay(backoff, undefined, { signal: stop.signal }).catch(() => {})
        backoff = Math.min(backoff * 2, 30_000)
      }
    }
  }

  async function cleanup() {
    clearInterval(heartbeat)
    stop.abort()
    await Promise.allSettled([...providers.values()].map(async promise => (await promise).close()))
    await Promise.allSettled([...executions.values()].map(({ task }) => task))
    await postChain.catch(() => {})
    await journal.close()
  }

  return {
    run() {
      running ??= run().catch(error => { if (!stop.signal.aborted) fail(error) }).finally(cleanup).then(() => { if (failure) throw failure })
      return running
    },
    async close() { stop.abort(); closing ??= running ? running.catch(() => {}) : cleanup(); await closing },
  }
}

async function main() {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    ship: { type: 'string' }, runner: { type: 'string' }, 'key-file': { type: 'string' }, repo: { type: 'string' }, state: { type: 'string' },
    agent: { type: 'string', default: 'acp' }, model: { type: 'string', default: '' }, sandbox: { type: 'string', default: 'read-only' },
    allow: { type: 'string', multiple: true, default: [] }, 'harness-tool': { type: 'string', multiple: true, default: [] }, help: { type: 'boolean', short: 'h' },
  } })
  if (values.help) {
    process.stdout.write('Usage: node acp/connected-runner.mjs --ship https://ship.example --runner laptop --key-file /private/runner.key --repo /repo --state /private/runner.json [--agent acp|codex] [--model NAME] [--sandbox read-only|workspace-write] [--harness-tool NAME] [--allow KIND] [-- agent-command ...args]\n')
    return
  }
  let key = process.env.HARNESS_RUNNER_KEY
  if (values['key-file']) {
    const info = await lstat(values['key-file'])
    if (!info.isFile() || info.mode & 0o077 || info.size > 128) throw new Error('Key file must be a private regular file (mode 600).')
    key = (await readFile(values['key-file'], 'utf8')).trim()
  }
  const client = await createRunner({ ship: values.ship, runner: values.runner, key, repo: values.repo, state: values.state, agentType: values.agent, model: values.model, sandbox: values.sandbox, allow: values.allow, harnessTools: values['harness-tool'], ...(positionals.length ? { command: positionals } : {}) })
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { void client.close() })
  await client.run()
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1 })
