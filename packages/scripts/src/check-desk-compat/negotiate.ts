import { Tree } from './git';
import { stripComment } from './hoon';

export interface ProtocolDifference {
  /** The agent whose expectation cannot be met. */
  agent: string;
  /** The agent it expects that protocol version *of*. */
  peer: string;
  protocol: string;
  /** What the client-side desk has for this pair. */
  clientDeskVersions: string[];
  /** What the desk under test has for it. */
  n1Versions: string[];
}

/**
 * The two halves of an agent's `agent:neg` charge.
 *
 * `desk/lib/negotiate.hoon` takes them separately and they mean opposite
 * things: `exposed` is what this agent tells others it speaks, `expected` is
 * what it demands of each peer before it will subscribe or poke. Unioning the
 * version atoms — which is what this reader used to do — conflates the two, so
 * adding an expectation a peer already satisfies reads as a version change and
 * blocks a release that is in fact compatible.
 */
export interface Charge {
  /** protocol -> version this agent exposes */
  exposed: Map<string, string>;
  /** peer agent -> protocol -> version this agent expects of it */
  expected: Map<string, Map<string, string>>;
}

/**
 * Read an agent's charge.
 *
 * Line-based, because the charge is written one entry per line:
 *
 *     %-  %-  agent:neg
 *         :+  notify=&
 *           [~.groups^%3 ~ ~]                 <- exposed
 *         %-  my
 *         :~  %groups^[~.groups^%3 ~ ~]       <- expected of %groups
 *             %channels^[~.channels^%4 ~ ~]   <- expected of %channels
 *         ==
 *
 * A line that names a peer before its bracket is an expectation; any other
 * line carrying version atoms is the exposed map, which covers the inline
 * spelling `%-  %-  agent:neg  [~.groups^%4 ~ ~]` too.
 */
export function chargeInSource(source: string): Charge {
  const exposed = new Map<string, string>();
  const expected = new Map<string, Map<string, string>>();
  let inBlock = false;
  for (const raw of source.split('\n')) {
    // A commented-out charge (`:: was [~.groups^%2 ~ ~]`) is not a
    // declaration; reading one would invent a version difference and block
    // every pair.
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
    // A peer's expectations are written `<dude>^[…]`, where the dude is
    // spelled `%chat` or `~.contacts` depending on the agent. Those segments
    // are read first and cut out; whatever version atoms remain on the line
    // are the exposed map, which covers `expose=[…]` and the inline form.
    let rest = line;
    for (const seg of line.matchAll(
      /(?:%|~\.)([a-z][a-z0-9-]*)\^\[([^\]]*)\]/g
    )) {
      const mine = expected.get(seg[1]) ?? new Map<string, string>();
      for (const m of seg[2].matchAll(/~\.([a-z][a-z0-9-]*)\^%(\d+)/g)) {
        mine.set(m[1], m[2]);
      }
      expected.set(seg[1], mine);
      rest = rest.replace(seg[0], '');
    }
    for (const m of rest.matchAll(/~\.([a-z][a-z0-9-]*)\^%(\d+)/g)) {
      exposed.set(m[1], m[2]);
    }
  }
  return { exposed, expected };
}

function chargesByAgent(tree: Tree): Map<string, Charge> {
  const out = new Map<string, Charge>();
  for (const file of tree.list('desk/app', (p) => p.endsWith('.hoon'))) {
    const charge = chargeInSource(tree.readFile(file) ?? '');
    if (charge.exposed.size > 0 || charge.expected.size > 0) {
      out.set(file.replace(/^desk\/app\//, '').replace(/\.hoon$/, ''), charge);
    }
  }
  return out;
}

/**
 * Rule (d): a protocol version difference between two desks blocks the pair
 * outright. `negotiate` refuses them regardless of what the paths say, so this
 * is reported ahead of any dispatch analysis.
 *
 * A difference is one side *expecting* a version the other side does not
 * *expose*. Both directions are checked — the candidate against N-1's peers,
 * and N-1 against the candidate's — because either way the pair will not
 * match. An expectation the peer already satisfies is no difference at all,
 * and a peer that is absent from the other desk is somebody else's agent.
 */
export function compareProtocols(
  clientDesk: Tree,
  n1Desk: Tree
): ProtocolDifference[] {
  const a = chargesByAgent(clientDesk);
  const b = chargesByAgent(n1Desk);
  const seen = new Map<string, ProtocolDifference>();

  const check = (
    expecting: Map<string, Charge>,
    exposing: Map<string, Charge>,
    /** Which column the *expecting* side's version belongs in. */
    side: 'client' | 'n1'
  ) => {
    for (const [agent, charge] of expecting) {
      for (const [peer, protocols] of charge.expected) {
        const theirs = exposing.get(peer);
        // Not an agent of theirs to answer for.
        if (!theirs) continue;
        for (const [protocol, want] of protocols) {
          const have = theirs.exposed.get(protocol);
          if (have === want) continue;
          const key = `${agent} ${peer} ${protocol}`;
          const entry = seen.get(key) ?? {
            agent,
            peer,
            protocol,
            clientDeskVersions: [],
            n1Versions: [],
          };
          if (side === 'client') {
            entry.clientDeskVersions = [want];
            if (have !== undefined) entry.n1Versions = [have];
          } else {
            entry.n1Versions = [want];
            if (have !== undefined) entry.clientDeskVersions = [have];
          }
          seen.set(key, entry);
        }
      }
    }
  };
  check(a, b, 'client');
  check(b, a, 'n1');

  return [...seen.values()].sort((x, y) =>
    `${x.agent} ${x.peer} ${x.protocol}`.localeCompare(
      `${y.agent} ${y.peer} ${y.protocol}`
    )
  );
}
