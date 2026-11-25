// Run Hoon threads on a fake ship through scripts/click, which needs the ship's
// pier, as SHIP_PIER or PEER_PIER name it, rather than its URL, and the urbit
// binary on PATH, as scripts/test-js.sh runs the tests: beside their ships.
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const click = new URL('../../scripts/click', import.meta.url).pathname
const run = promisify(execFile)

// Run the thread whose lines are `lines` on the ship at `pier`, and return
// click's output. click joins its input lines with a single space and puts the
// thread in a cord, escaping only ', so the lines go as one line joined with a
// gap, with \ escaped here. click exits zero even when the thread fails.
export async function thread(pier, lines, seconds = 60) {
  const child = run(click, ['-b', 'urbit', '-t', String(seconds), '-i', '-', '-kp', pier], { timeout: (seconds + 30) * 1000 })
  child.child.stdin.end(`${lines.join('  ').replaceAll('\\', '\\\\')}\n`)
  const { stdout, stderr } = await child
  if (!stdout.includes('[0 %avow 0 %noun ')) throw new Error(`Thread failed on ${pier}: ${stdout.trim()} ${stderr.trim()}`)
  return stdout
}

// Poke our own %hood, as |rein and |revive do.
const kiln = (pier, cage) => thread(pier, [
  '=/  m  (strand ,vase)',
  ';<  our=ship  bind:m  get-our',
  ...cage,
  '(pure:m !>(~))',
])

// |rein DESK [ON AGENT]: start or stop one agent of a desk, keeping its other reins.
export const rein = (pier, desk, agent, on) => kiln(pier, [
  ';<  =cone:clay  bind:m  (scry cone:clay /cx//domes)',
  `=/  ren  (~(put by ren:(~(got by cone) [our %${desk}])) %${agent} ${on ? '&' : '|'})`,
  `;<  ~  bind:m  (poke [our %hood] kiln-rein+!>([%${desk} ren]))`,
])

// |revive DESK
export const revive = (pier, desk) => kiln(pier, [`;<  ~  bind:m  (poke [our %hood] kiln-revive+!>(%${desk}))`])