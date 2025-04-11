import { inlineSummary } from '@tloncorp/shared/logic';
import type * as ub from '@tloncorp/shared/urbit';
import {
  getContent,
  getSourceForEvent,
  sourceToString,
} from '@tloncorp/shared/urbit/activity';

export function renderActivityEventPreview({
  event: ev,
}: {
  event: ub.ActivityEvent;
}): {
  title: string;
  body: string;
  userInfo: Record<string, string>;
} | null {
  const content = getContent(ev);
  if (content == null) {
    return null;
  }
  return {
    title: (() => {
      const source = getSourceForEvent(ev);
      // TODO: Get titles instead of IDs
      return sourceToString(source, true);
    })(),
    body: inlineSummary(content),
    userInfo: {
      // TODO
    },
  };
}
