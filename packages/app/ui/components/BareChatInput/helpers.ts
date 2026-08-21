// Sourced from the `logic` subpath rather than the `@tloncorp/shared` root
// (which re-exports it): the root barrel pulls in expo-modules-core, which
// cannot load in the plain node vitest environment, so importing it here
// would make this module untestable.
import { CONTAINS_REF_REGEX } from '@tloncorp/shared/logic';

export {
  textAndMentionsToContent,
  contentToTextAndMentions,
} from '@tloncorp/shared/logic';

export type TextChangeAction = 'processReferences' | 'update' | 'none';

// Decision for BareChatInput's onChangeText. Evaluates the ref check exactly
// once with a non-global regex: the previous two-`.test()` version depended on
// the g-flagged REF_REGEX's hidden lastIndex and could misroute or drop events
// (TLON-6365). 'none' (refs present but already processed) is the guard that
// prevents an infinite onChangeText loop on native.
export function computeTextChangeAction(
  newText: string,
  lastProcessedText: string
): TextChangeAction {
  const hasRefs = CONTAINS_REF_REGEX.test(newText);
  if (hasRefs && lastProcessedText !== newText) {
    return 'processReferences';
  }
  if (!hasRefs) {
    return 'update';
  }
  return 'none';
}
