import type { MarkdownRange } from '@expensify/react-native-live-markdown';

// Mirrors markdownToStory's mention detection (packages/api/src/client/markdown/
// shipMentionPlugin.ts + groupMentionPlugin.ts) so every range we highlight is a
// substring the serializer turns into a { ship } / { sect } inline.
//   ~ship        -> 'mention-user'
//   @role / @all  -> 'mention-here'
// Tagged 'worklet' so it can be called from the MarkdownTextInput parser worklet;
// the directive is an inert string when run off-worklet (e.g. in tests).
export function findMentionRanges(text: string): MarkdownRange[] {
  'worklet';
  const ranges: MarkdownRange[] = [];

  const shipRe = /~[a-z]{3,6}(?:-[a-z]{6})*/g;
  let shipMatch: RegExpExecArray | null;
  while ((shipMatch = shipRe.exec(text)) !== null) {
    ranges.push({
      type: 'mention-user',
      start: shipMatch.index,
      length: shipMatch[0].length,
    });
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
    ranges.push({
      type: 'mention-here',
      start: groupMatch.index,
      length: groupMatch[0].length,
    });
  }

  ranges.sort((a, b) => a.start - b.start);
  return ranges;
}
