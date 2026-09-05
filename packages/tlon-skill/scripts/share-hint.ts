// The `Ref:` line is a load-bearing contract, not cosmetics: the Hermes
// groups prompt tells models to copy "the Ref: path from the command output"
// verbatim, and an old CLI printing no Ref: line is what gates the feature
// off on stale deployments. Kept in its own module because groups.ts runs
// main() at import and cannot be loaded from a test.
export function groupShareHintLines(groupId: string): [string, string] {
  return [
    `   Ref: /1/group/${groupId}`,
    `   Share: include the Ref path in a chat message to post a tappable group card.`,
  ];
}
