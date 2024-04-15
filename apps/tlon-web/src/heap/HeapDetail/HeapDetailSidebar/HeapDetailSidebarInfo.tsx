import { PostEssay } from '@tloncorp/shared/dist/urbit/channel';

import Author from '@/chat/ChatMessage/Author';
import getKindDataFromEssay from '@/logic/getKindData';
import { firstInlineSummary } from '@/logic/tiptap';
import { URL_REGEX, getFirstInline, makePrettyDay } from '@/logic/utils';
import { useIsPostPending } from '@/state/channel/channel';

interface HeapDetailSidebarProps {
  essay: PostEssay;
}

export default function HeapDetailSidebarInfo({
  essay,
}: HeapDetailSidebarProps) {
  const { content, author, sent } = essay;
  const isPending = useIsPostPending({
    author,
    sent,
  });
  if (!content || content.length === 0) return null;

  const { title } = getKindDataFromEssay(essay);
  const unixDate = new Date(sent);
  const inlineContent = getFirstInline(content) || '';
  const stringContent = inlineContent.toString();
  const textPreview = firstInlineSummary(content);
  const isURL = URL_REGEX.test(stringContent);

  return (
    <div className="m-4 flex flex-col space-y-4 rounded-lg bg-gray-50 p-4">
      <h2 className="line-clamp-1 break-all text-base font-semibold text-gray-800">
        {title && title}
        {!title && !isURL ? textPreview : null}
      </h2>

      <div className="flex">
        <time className="text-base font-semibold text-gray-400">
          {makePrettyDay(unixDate)}
        </time>
        {isPending && (
          <span className="ml-auto text-sm font-semibold text-gray-400">
            Saved, awaiting host confirmation
          </span>
        )}
      </div>

      <Author ship={author} />
    </div>
  );
}
