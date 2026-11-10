// Architectural checks complement behavior tests: keep dependency direction
// legible as capabilities are added. File size is a guideline, not a test.
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile, readdir } from 'node:fs/promises'

const directory = new URL('../desk/lib/', import.meta.url)
const sources = new Map(await Promise.all((await readdir(directory))
  .filter((name) => /^harness(?:-.*)?\.hoon$/.test(name))
  .map(async (name) => [name.slice(0, -5), await readFile(new URL(name, directory), 'utf8')])))
const code = (name) => sources.get(name).split('\n').filter((line) => !line.trimStart().startsWith('::')).join('\n')
const dependencies = (name) => [...code(name).matchAll(/^\/\+  (.+(?:\n {4}.+)*)/gm)]
  .flatMap((match) => match[1].split(',').map((entry) => entry.trim().split('=').at(-1).replace(/^\*/, '')))

test('Ford headers place type imports before library imports', async () => {
  const root = new URL('../desk/', import.meta.url)
  for (const path of (await readdir(root, { recursive: true })).filter(path => path.endsWith('.hoon'))) {
    const source = await readFile(new URL(path, root), 'utf8')
    assert.doesNotMatch(source, /^\/\+[\s\S]*^\/-/m, path)
  }
})

test('work guidance teaches bounded decomposition and quiet cross-ship coordination', () => {
  const tools = code('harness-tools')
  const workspace = tools.match(/:\*\s+'workspace'\s+'((?:\\.|[^'\\])*)'/)?.[1]
  assert.ok(workspace, 'Workspace schema includes its work guidance')
  for (const instruction of ['completion check', 'dependencies', 'Keep tightly coupled steps together',
    'capable agents', 'reassess', 'one home record', 'mutual Workspace grants',
    'Never change trust', 'Keep coordination in the background', 'actual blockers',
    'Ordinary questions need neither', 'not promise later follow-up',
    'set status done with a concise verified outcome before replying', 'Never leave completed work open']) {
    assert.ok(workspace.includes(instruction), `Missing work guidance: ${instruction}`)
  }
  assert.ok(workspace.length < 2600, 'Keep work guidance focused; action details belong in help')
  assert.match(tools, /mutually trusted ship/)
  assert.match(tools, /inspect the home task and never resend automatically/)
})

test('permission synchronization is change-driven and trust reads stay small', async () => {
  const agent = await readFile(new URL('../desk/app/harness.hoon', import.meta.url), 'utf8')
  assert.match(agent, /before-access\s+access-inputs:hc/)
  assert.match(agent, /\?:\s+=\(before-access access-inputs:hc\)\s+`state\s+sync-peer-access:hc/)
  const refresh = agent.split('++  action-peer-refresh\n')[1].split('\n++  ')[0]
  assert.match(agent, /%peer-refresh\s+\(action-peer-refresh action\)/)
  assert.match(refresh, /=\.\s+state\s+discover-local-mcp\s+sync-peer-access/)
  const flush = agent.split(/\n[ \t]+finish-event\n/)[1].split(/\n[ \t]*\+\+  on-init\b/)[0]
  assert.doesNotMatch(flush, /mcp-server|discover-local-mcp/)
  assert.match(agent, /\?:\s+!=\(0 local-mcp-seen\)\s+state/)
  assert.doesNotMatch(code('harness-peer-trust'), /status\/json|mole|dejs|cron|ledger/)
  assert.match(code('harness-peer-trust'), /peer-trust\/noun/)
  const settings = agent.split('++  peer-settings\n')[1].split('\n++  peer-revision')[0]
  assert.equal((settings.match(/snapshot:~\(\. peer-trust bowl\)/g) || []).length, 1)
  assert.doesNotMatch(settings, /trusted-peers|effective-peers|\(is-owner /)
})

test('Tlon starts listening on install without overriding saved enable choices', async () => {
  const agent = await readFile(new URL('../desk/app/harness-tlon.hoon', import.meta.url), 'utf8')
  const init = agent.split('++  on-init\n')[1].split('\n++  on-save')[0]
  assert.match(init, /policy \[& ~ ~ %mentions ~ ~\]/)
  assert.match(init, /initialize-owner:cor[\s\S]+abet:boot:refresh-peers:cor/)
  const reload = agent.split('++  on-load\n')[1].split('\n++  on-poke')[0]
  assert.doesNotMatch(reload, /policy \[|enabled\.policy\s+&/)
  const boot = agent.split('++  boot\n')[1].split('\n++  watch-head')[0]
  assert.match(boot, /\?\.  enabled\.policy  cor/)
  assert.match(boot, /watch-head[\s\S]+%activity\] %watch \/v4/)
})

test('default native tests do not construct full Gall agents', async () => {
  const tests = new URL('../desk/tests/', import.meta.url)
  for (const name of await readdir(tests)) {
    if (!name.endsWith('.hoon')) continue
    assert.doesNotMatch(name, /benchmark/, 'large corpus benchmarks must be opt-in')
    const source = await readFile(new URL(name, tests), 'utf8')
    assert.doesNotMatch(source, /^\/=\s+.*\/app\//m,
      `${name}: full-agent fixtures belong in tests-integration, outside the default 2 GB loom suite`)
  }
})

test('pending owner DM requests reconcile at boot and permission changes, not periodic maintenance', async () => {
  const agent = await readFile(new URL('../desk/app/harness-tlon.hoon', import.meta.url), 'utf8')
  const boot = agent.split('++  boot\n')[1].split('\n++  watch-head')[0]
  assert.match(boot, /\?\.  enabled\.policy  cor\s+=\.  cor  accept-owner-invitations/)
  const reconcile = agent.split('++  accept-owner-invitations\n')[1].split('\n++  publications-connected')[0]
  assert.match(reconcile, /owner-invitations:messenger actor-owner/)
  const configure = agent.split('++  configure\n')[1].split('\n++  agent')[0]
  assert.match(configure, /policy  updated-policy[\s\S]+schedule:accept-owner-invitations/)
  const maintenance = agent.split('++  maintain\n')[1].split('\n++  recover')[0]
  assert.doesNotMatch(maintenance, /accept-owner-invitations/)
  const projection = code('harness-tlon-io').split('++  owner-invitations\n')[1].split('\n++  publish')[0]
  assert.match(projection, /dm\/invited\/ships/)
  assert.match(projection, /\?\.  \(owner-test who\)  ~/)
})

test('semantic head depends on nouns, not providers or transports', () => {
  for (const name of ['harness', 'harness-context', 'harness-memory', 'harness-lcm']) {
    const expected = { harness: ['harness-lcm', 'harness-context'], 'harness-memory': ['harness-memory-index', 'harness-text'] }
    assert.deepEqual(dependencies(name), expected[name] || [])
    assert.doesNotMatch(code(name), /\bjson\b|\.\^\(|%pass|bowl:gall/)
  }
})

test('client settlement consumes the core outcome instead of defining completion', async () => {
  const agent = await readFile(new URL('../desk/app/harness.hoon', import.meta.url), 'utf8')
  for (const name of ['settle-acp', 'settle-hands', 'settle-sub', 'settle-asks']) {
    const arm = agent.split(`++  ${name}\n`)[1]?.split('\n++  ')[0]
    assert.ok(arm, `Missing settlement boundary: ${name}`)
    assert.match(arm, /outcome:hl/)
    assert.doesNotMatch(arm, /rear items|pending\.v|wait\.v|\[\[%cancelled/)
  }
})

test('concrete bindings cannot import the session store or become an orchestrator', () => {
  for (const name of ['harness-effects', 'harness-acp']) {
    assert.doesNotMatch(code(name), /harness-store|state-\d|sessions=\(map/)
    assert.ok(!dependencies(name).includes('harness-session'))
  }
})

test('Harness libraries have no dependency cycles', () => {
  const done = new Set()
  function visit(name, path = []) {
    assert.ok(!path.includes(name), `Dependency cycle: ${[...path, name].join(' -> ')}`)
    if (done.has(name) || !sources.has(name)) return
    for (const next of dependencies(name)) visit(next, [...path, name])
    done.add(name)
  }
  for (const name of sources.keys()) visit(name)
})

test('inbox is a bounded owner projection, not a transcript reader or mutation path', async () => {
  const projection = code('harness-inbox')
  assert.doesNotMatch(projection, /play:|harness-session|harness-store|bowl:gall|%pass|\.\^\(|command\.pending|body\.value\.proposal/)
  assert.match(projection, /\(lte limit 32\)/)
  assert.match(projection, /\(row-json row db hands jobs native\)/)
  const agent = await readFile(new URL('../desk/app/harness.hoon', import.meta.url), 'utf8')
  const handler = agent.split('++  acp-inbox\n')[1].split('\n++  ')[0]
  assert.match(handler, /decode:admin connection/)
  assert.match(handler, /read:inbox/)
  assert.doesNotMatch(handler, /handle-action|workspace-apply|hand-call/)
})

test('project client reads have no execution imports, owner promotion or notebook body listing', async () => {
  const capability = code('harness-project-client')
  assert.deepEqual(dependencies('harness-project-client'), ['harness-workspace-json', 'harness-workspace'])
  assert.doesNotMatch(capability, /harness-store|harness-session|%pass|\.\^\(|bowl:gall/)
  const agent = await readFile(new URL('../desk/app/harness.hoon', import.meta.url), 'utf8')
  const handler = agent.split('++  serve-project-read\n')[1].split('\n++  serve\n')[0]
  assert.match(handler, /authenticate:project-client/)
  assert.match(handler, /read-action:project-client/)
  assert.match(handler, /refresh-scoped:/)
  assert.doesNotMatch(handler, /workspace-owner|workspace-request|handle-action|hand-call|authenticated\.req|acp-open|%poke/)
  const fastPath = agent.split('++  on-poke\n')[1].split('  %-  finish-event')[0]
  assert.match(fastPath, /serve-project-read:hc/)
  assert.match(fastPath, /%handle-http-request/)
  const scoped = code('harness-notes').split('  ++  refresh-scoped\n')[1].split('  ++  refresh\n')[0]
  assert.match(scoped, /\(note book note\.link\)/)
  assert.doesNotMatch(scoped, /\/v0\/notes\//)
})

test('local inspection and owner sync share one projection without granting Steward trust', async () => {
  assert.equal(sources.has('harness-run-report'), true)
  const adapter = await readFile(new URL('../desk/app/harness-tlon.hoon', import.meta.url), 'utf8')
  const head = await readFile(new URL('../desk/app/harness.hoon', import.meta.url), 'utf8')
  assert.match(head, /harness\/session\/runs/)
  assert.match(head, /Run inspection is owner-only/)
  assert.match(adapter, /sync-lenses/)
  assert.match(adapter, /owner\.lens owner\.policy/)
  assert.doesNotMatch(adapter, /%trust-bot|%untrust-bot/)
  assert.doesNotMatch(code('harness-tlon-io'), /steward|trust-policy/)
})

test('Tlon is a replaceable hand, not an inference engine', async () => {
  for (const name of ['harness', 'harness-session', 'harness-hand']) {
    assert.doesNotMatch(code(name), /tlon|groups|contacts/)
  }
  for (const name of ['harness-tlon-policy', 'harness-tlon-story']) {
    assert.doesNotMatch(code(name), /\.\^\(|%pass|bowl:gall/)
  }
  const adapter = await readFile(new URL('../desk/app/harness-tlon.hoon', import.meta.url), 'utf8')
  assert.doesNotMatch(adapter, /%connect\b|%request.*%iris|harness-provider|harness-store/)
  assert.match(adapter, /%harness-hand/)
})
test('schedules have one shared head owner and no adapter timer', async () => {
  assert.doesNotMatch(code('harness-schedule'), /harness-tlon|bowl:gall|%pass|\.\^\(/)
  const head = await readFile(new URL('../desk/app/harness.hoon', import.meta.url), 'utf8')
  const adapter = await readFile(new URL('../desk/app/harness-tlon.hoon', import.meta.url), 'utf8')
  assert.match(head, /poll-schedules:hc/)
  assert.doesNotMatch(head, /%harness-cron-import|tlon-cron-imported/)
  assert.match(head, /harness\/cron/)
  assert.doesNotMatch(adapter, /\+\+  (?:add-cron|poll-cron|stop-cron)/)
  assert.doesNotMatch(code('harness-tlon-clock'), /cron|schedule/)
})
test('scheduler maintenance is change-driven without caching effect authority', async () => {
  const head = await readFile(new URL('../desk/app/harness.hoon', import.meta.url), 'utf8')
  const arm = (name) => head.split(`++  ${name}\n`)[1]?.split('\n++  ')[0]
  assert.match(head, /before-scheduler\s+schedule-inputs:hc/)
  assert.match(head, /maintenance-needed:schedule-lib\s+schedules\s+schedule-wake\s+now\.bowl\s+!=\(before-scheduler schedule-inputs:hc\)/)
  const inputs = arm('schedule-inputs').split('\n').filter((line) => !line.trimStart().startsWith('::')).join('\n')
  for (const input of ['schedules', 'sessions', 'hands', 'rehearsals', 'peers', 'peer-limits', 'announced-access', 'tools.defaults']) {
    assert.ok(inputs.includes(input), `Missing scheduler invalidation input: ${input}`)
  }
  assert.doesNotMatch(inputs, /\.\^\(|acp-through|model-requests|streams/)
  assert.match(arm('poll-schedules'), /\(schedule-live job\)/)
  assert.match(arm('execution-tools'), /\(schedule-live u\.scheduled\)/)
  assert.match(head, /\[%x %cron-authority @ ~\][\s\S]*?\(schedule-live:hc u\.job\)/)
})
test('channel reconciliation uses self-role events and native live read authority', async () => {
  const adapter = await readFile(new URL('../desk/app/harness-tlon.hoon', import.meta.url), 'utf8')
  const activity = adapter.split('++  activity\n')[1].split('\n++  ')[0]
  assert.match(activity, /target:membership our\.bowl enabled\.policy event/)
  assert.match(activity, /reconcile:~\(\. io:membership bowl\)/)
  const membership = code('harness-tlon-membership')
  assert.ok(dependencies('harness-tlon-membership').includes('harness-tlon-paths'))
  assert.match(membership, /\+\*\s+read-path\s+~\(\. paths \[our now\]:bowl\)/)
  assert.match(membership, /\.\^\s+\$-\(\[@p nest:g\] \?\)\s+%gx\s+\(group-can-read:read-path flag\)/)
  const readPath = code('harness-tlon-paths').split('++  group-can-read\n')[1].split('\n--')[0]
  assert.match(readPath, /\/groups\/\(scot %da now\)\/v2\/groups\/\(scot %p -\.flag\)\/\[\+\.flag\]/)
  assert.match(readPath, /\/channels\/can-read\/noun/)
  assert.match(membership, /load\.net\.u\.channel/)
  assert.doesNotMatch(membership, /%behn|%iris|harness-provider|harness-store|%group-join/)
})
test('unpermissioned Tlon senders have a local audit, never an outbound denial', async () => {
  const adapter = await readFile(new URL('../desk/app/harness-tlon.hoon', import.meta.url), 'utf8')
  const arm = adapter.split('++  record-denial\n')[1].split('\n++  ')[0]
  assert.match(arm, /allowed:denial/)
  assert.match(arm, /note 'permission-denied'/)
  assert.doesNotMatch(arm, /%pass|publish|messenger|last-sent/)
  assert.doesNotMatch(code('harness-tlon-denial'), /\+\+  message/)
})
test('native hook mutation subscribes before dispatch and waits beyond transport acknowledgement', async () => {
  const adapter = await readFile(new URL('../desk/app/harness-tlon.hoon', import.meta.url), 'utf8')
  const hookTool = code('harness-tlon-hook-tool')
  assert.match(hookTool, /\(command args\)[\s\S]*%watch \/v0\/hooks/)
  assert.doesNotMatch(hookTool, /%poke/)
  const watch = adapter.split('++  agent-tlon-hooks\n')[1].split('\n++  ')[0]
  const dispatch = watch.search(/%poke\s+%hook-action-0/)
  assert.ok(dispatch >= 0, 'Hook mutation dispatch exists')
  assert.ok(watch.indexOf('tool-authority request.u.receipt') < dispatch)
  assert.ok(watch.indexOf("u.receipt(body 'pending: awaiting native hook result')") < dispatch)
  assert.match(watch, /%hook-response-0/)
  const ack = adapter.split('++  agent-tlon-hook-poke\n')[1].split('\n++  ')[0]
  assert.match(ack, /\?~  p.sign  cor/)
})

test('Notes migration verifies native affiliation and fresh authority before dispatch', async () => {
  const adapter = await readFile(new URL('../desk/app/harness-tlon.hoon', import.meta.url), 'utf8')
  const migration = await readFile(new URL('../desk/lib/harness-tlon-notes-migration.hoon', import.meta.url), 'utf8')
  assert.match(migration, /group\.notebook-state\.snapshot/)
  assert.match(migration, /%watch\s+\/v0\/notes/)
  assert.match(adapter, /\[%tlon-notes-migration @ ~\][\s\S]*tool-authority request\.u\.receipt[\s\S]*command:~\(\. notes-migration bowl\)[\s\S]*%poke\s+%notes-action-1/)
  assert.match(adapter, /another native Notes change is pending/)
  assert.doesNotMatch(migration, /%delete|%rename/)
})

test('history pagination is bounded, read-only and follows current lane authority', async () => {
  const reader = code('harness-tlon-history-read')
  assert.doesNotMatch(reader, /%poke|%pass|%watch|harness-store/)
  assert.match(reader, /\(lte count 65\)/)
  assert.match(reader, /\/older\/\(scot %ud u.before\)/)
  assert.doesNotMatch(code('harness-tlon-history-page'), /\.\^\(|%pass|bowl:gall/)
  const adapter = await readFile(new URL('../desk/app/harness-tlon.hoon', import.meta.url), 'utf8')
  const tool = adapter.split('++  tool\n')[1].split('\n++  ')[0]
  const conversation = adapter.split('++  tool-conversation\n')[1].split('\n++  ')[0]
  assert.match(tool, /\(tool-authority request\)/)
  assert.match(tool, /\(tool-conversation request id\)/)
  assert.ok(tool.indexOf('(tool-authority request)') < tool.indexOf('(tool-conversation request id)'))
  assert.match(conversation, /\(lane-grants u.lane ~\)/)
  assert.ok(conversation.indexOf('(lane-grants u.lane ~)') < conversation.indexOf("=('tlon_history_page'"))
  assert.match(conversation, /sham \[sid.request epoch.u.lane actor.u.lane to.u.lane name.call.request needle\]/)
  assert.match(conversation, /load:~\(\. history-read bowl\) to.u.lane before/)
})

test('Tlon addressing cannot become a second memory or command authority', () => {
  assert.doesNotMatch(code('harness-tlon-input'), /%memory-set|%command-completed|harness-provider|harness-memory|harness-command|%pass|\.\^\(/)
  assert.match(code('harness-tlon-policy'), /text:input our content.event/)
  assert.doesNotMatch(code('harness-memory'), /\.\^\(|%pass|bowl:gall|harness-store|session-id/)
})

test('Tlon messages are driven by head facts and receipts, never maintenance wakes', async () => {
  const adapter = await readFile(new URL('../desk/app/harness-tlon.hoon', import.meta.url), 'utf8')
  const arm = (name) => adapter.split(`++  ${name}\n`)[1]?.split('\n++  ')[0]
  assert.match(arm('on-arvo'), /maintain:cor/)
  assert.doesNotMatch(arm('maintain'), /reconcile|%claim|publish/)
  assert.match(arm('agent'), /\[%head ~\]\s+\(agent-head wire sign\)/)
  assert.match(arm('agent-head'), /%fact[\s\S]*reconcile/)
  assert.match(arm('agent-hand'), /%receipt phase\)[\s\S]*attempt\.u\.delivery[\s\S]*reconcile\(deliveries/)
  assert.doesNotMatch(code('harness-tlon-clock'), /deliveries|observations|outbox|jobs/)
  assert.match(arm('watch-head'), /%watch \/hand-events/)
  assert.match(arm('claimed'), /%claim stage\.u\.delivery/)
  assert.match(arm('claimed'), /attempt:\(get-control:hd hands id\)/)
})

test('every inference turn names the operating ship from the bowl at dispatch', async () => {
  const agent = await readFile(new URL('../desk/app/harness.hoon', import.meta.url), 'utf8')
  const dispatch = agent.split('++  llm-card\n')[1].split('\n++  ')[0]
  assert.match(dispatch, /identify:hp\s+view\s+kind\s+our\.bowl/)
  assert.ok(dispatch.indexOf('identify:hp') < dispatch.indexOf('payload-with-capture:hp'), 'identity precedes encoding')
  assert.equal((agent.match(/payload(?:-with-capture)?:hp /g) || []).length, 1, 'llm-card is the only encoding boundary')
  const identify = code('harness-provider').split('++  identify\n')[1].split('\n++  ')[0]
  assert.match(identify, /\?\.  =\(%turn kind\)  view/)
  assert.match(identify, /\(scot %p our\)/)
  assert.doesNotMatch(identify, /~[a-z]{3}(?:[a-z]{3})?(?:-[a-z]{6})*\b/, 'no hard-coded ship')
})

test('prompt cords escape newlines, not literal backslashes', async () => {
  const root = new URL('../desk/', import.meta.url)
  for (const path of (await readdir(root, { recursive: true })).filter(path => path.endsWith('.hoon'))) {
    const source = await readFile(new URL(path, root), 'utf8')
    assert.doesNotMatch(source, /\\\\0a/, `${path}: '\\\\0a' is a literal backslash, not a newline`)
  }
  const adapter = await readFile(new URL('../desk/app/harness-tlon.hoon', import.meta.url), 'utf8')
  const start = adapter.split('++  start-route\n')[1].split('\n++  ')[0]
  assert.match(start, /system\.config\n\s+'\\0a\\0aThis session is a Tlon conversation with '/)
})
test('Harness CI triggers on exactly the Tlon files the desk compiles against', async () => {
  const listed = (await readFile(new URL('../tlon-files.txt', import.meta.url), 'utf8')).split('\n')
    .filter((line) => /^[^#\s]/.test(line)).map((file) => `desk/${file}`).sort()
  const workflow = await readFile(new URL('../../../.github/workflows/harness-ci.yml', import.meta.url), 'utf8')
  const lists = [...workflow.matchAll(/^ +paths:\n((?: +- .*\n)+)/gm)]
    .map((match) => [...match[1].matchAll(/- "(desk\/[^"]*)"/g)].map((entry) => entry[1]).sort())
  assert.equal(lists.length, 2, 'expected pull_request and push path lists')
  for (const paths of lists) assert.deepEqual(paths, listed)
})
