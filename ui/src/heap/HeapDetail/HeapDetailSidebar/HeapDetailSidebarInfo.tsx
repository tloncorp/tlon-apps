import { URL_REGEX, getFirstInline, makePrettyDay } from '@/logic/utils';
import { firstInlineSummary } from '@/logic/tiptap';
import Author from '@/chat/ChatMessage/Author';
import { PostEssay } from '@/types/channel';
import getKindDataFromEssay from '@/logic/getKindData';

interface HeapDetailSidebarProps {
  essay: PostEssay;
}

export default function HeapDetailSidebarInfo({
  essay,
}: HeapDetailSidebarProps) {
  const { content, author, sent } = essay;
  if (!content || content.length === 0) return null;

  const { title } = getKindDataFromEssay(essay);
  const unixDate = new Date(sent);
  const inlineContent = getFirstInline(content) || '';
  const stringContent = inlineContent.toString();
  const textPreview = firstInlineSummary(content);
  const isURL = URL_REGEX.test(stringContent);

  return (
    <div className="m-4 flex flex-col space-y-4 rounded-lg bg-gray-50 p-4">
      <h2 className="break-all text-base font-semibold text-gray-800 line-clamp-1">
        {title && title}
        {!title && !isURL ? textPreview : null}
      </h2>

      <time className="text-base font-semibold text-gray-400">
        {makePrettyDay(unixDate)}
      </time>

      <Author ship={author} />
    </div>
  );
}
