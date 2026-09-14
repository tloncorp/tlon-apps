import { Tree } from './git';
import { stripComment } from './hoon';

export interface ProtocolDifference {
  agent: string;
  protocol: string;
  clientDeskVersions: string[];
  n1Versions: string[];
}

/**
 * Every `agent:neg` protocol version an agent declares, exposed or expected.
 *
 * The version-carrying atom is always `~.<term>^%<n>`, and the same atom
 * appears verbatim in both the expose slot and every dependent's expect map —
 * so collecting the set per agent and comparing sets catches a bump without
 * modelling which slot is which.
 */
export function protocolsInSource(source: string): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  let inBlock = false;
  for (const raw of source.split('\n')) {
    // A commented-out charge (`:: was [~.groups^%2 ~ ~]`) is not a
    // declaration; reading one would invent a version difference and
    // block every pair.
    const line = stripComment(raw);
    if (/agent:neg(otiate)?\b/.test(line)) inBlock = true;
    // The wrapper stack ends at the next agent combinator.
    else if (
      inBlock &&
      /^%-\s+agent:dbug|^\^-\s+agent:gall|^%\^\s+verb/.test(line)
    ) {
      inBlock = false;
      continue;
    }
    if (!inBlock) continue;
    // The triggering line is scanned too: `%-  %-  agent:neg  [~.groups^%4 ~ ~]`
    // carries its charge inline, and skipping it would hide the protocol.
    for (const m of line.matchAll(/~\.([a-z][a-z0-9-]*)\^%(\d+)/g)) {
      out.set(m[1], (out.get(m[1]) ?? new Set()).add(m[2]));
    }
  }
  return out;
}

function protocolsByAgent(tree: Tree): Map<string, Map<string, Set<string>>> {
  const out = new Map<string, Map<string, Set<string>>>();
  for (const file of tree.list('desk/app', (p) => p.endsWith('.hoon'))) {
    const protocols = protocolsInSource(tree.readFile(file) ?? '');
    if (protocols.size > 0) {
      out.set(
        file.replace(/^desk\/app\//, '').replace(/\.hoon$/, ''),
        protocols
      );
    }
  }
  return out;
}

/**
 * Rule (d): a protocol version difference between two desks blocks the pair
 * outright. `negotiate` refuses them regardless of what the paths say, so this
 * is reported ahead of any dispatch analysis.
 */
export function compareProtocols(
  clientDesk: Tree,
  n1Desk: Tree
): ProtocolDifference[] {
  const a = protocolsByAgent(clientDesk);
  const b = protocolsByAgent(n1Desk);
  const out: ProtocolDifference[] = [];
  for (const agent of [...new Set([...a.keys(), ...b.keys()])].sort()) {
    const left = a.get(agent) ?? new Map<string, Set<string>>();
    const right = b.get(agent) ?? new Map<string, Set<string>>();
    for (const protocol of [
      ...new Set([...left.keys(), ...right.keys()]),
    ].sort()) {
      const clientDeskVersions = [...(left.get(protocol) ?? [])].sort();
      const n1Versions = [...(right.get(protocol) ?? [])].sort();
      if (clientDeskVersions.join() !== n1Versions.join()) {
        out.push({ agent, protocol, clientDeskVersions, n1Versions });
      }
    }
  }
  return out;
}
