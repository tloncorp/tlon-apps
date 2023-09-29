import { URL_REGEX, makePrettyDay } from '@/logic/utils';
import { inlineToString } from '@/logic/tiptap';
import Author from '@/chat/ChatMessage/Author';
import { PostEssay, VerseInline } from '@/types/channel';
import getHanDataFromEssay from '@/logic/getHanData';

interface HeapDetailSidebarProps {
  essay: PostEssay;
}

export default function HeapDetailSidebarInfo({
  essay,
}: HeapDetailSidebarProps) {
  const { content, author, sent } = essay;
  if (!content || content.length === 0) return null;

  const { title } = getHanDataFromEssay(essay);
  const unixDate = new Date(sent);
  const inlineContent =
    (content.filter((c) => 'inline' in c)[0] as VerseInline).inline || '';
  const stringContent = inlineContent.toString();
  const textPreview = inlineContent
    .map((inline) => inlineToString(inline))
    .join(' ')
    .toString();
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
