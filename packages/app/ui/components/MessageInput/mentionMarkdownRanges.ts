import type { MarkdownRange } from '@expensify/react-native-live-markdown';

// Finds ranges to highlight as mentions, but only for the canonical strings the
// caller marks valid (Slack-style: mentions picked from the menu). Text that
// merely looks like a mention stays plain. Detection mirrors markdownToStory's
// regexes (packages/api/src/client/markdown/shipMentionPlugin.ts +
// groupMentionPlugin.ts):
//   ~ship        -> 'mention-user'  when `~ship` is in validShips
//   @all / @role  -> 'mention-here'  when the name (without `@`) is in validRoles
// Tagged 'worklet' so it can be called from the MarkdownTextInput parser worklet;
// the directive is an inert string when run off-worklet (e.g. in tests).
export function findMentionRanges(
  text: string,
  validShips: string[],
  validRoles: string[]
): MarkdownRange[] {
  'worklet';
  const ranges: MarkdownRange[] = [];

  const shipRe = /~[a-z]{3,6}(?:-[a-z]{6})*/g;
  let shipMatch: RegExpExecArray | null;
  while ((shipMatch = shipRe.exec(text)) !== null) {
    if (validShips.indexOf(shipMatch[0]) !== -1) {
      ranges.push({
        type: 'mention-user',
        start: shipMatch.index,
        length: shipMatch[0].length,
      });
    }
  }

  // `@` not preceded by an alphanumeric char (rejects emails/ids like foo@bar),
  // matching groupMentionPlugin's negative lookbehind without using lookbehind.
  const groupRe = /@[a-z][a-z0-9-]*/g;
  let groupMatch: RegExpExecArray | null;
  while ((groupMatch = groupRe.exec(text)) !== null) {
    const prev = groupMatch.index > 0 ? text[groupMatch.index - 1] : '';
    if (prev !== '' && /[A-Za-z0-9]/.test(prev)) {
      continue;
    }
    const role = groupMatch[0].slice(1);
    if (validRoles.indexOf(role) !== -1) {
      ranges.push({
        type: 'mention-here',
        start: groupMatch.index,
        length: groupMatch[0].length,
      });
    }
  }

  ranges.sort((a, b) => a.start - b.start);
  return ranges;
}
