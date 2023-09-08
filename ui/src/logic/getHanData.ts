import { NoteEssay } from '@/types/channel';

export default function getHanDataFromEssay(essay: NoteEssay): {
  title: string;
  image: string;
  notice?: null;
} {
  const { 'han-data': hanData } = essay;

  let title: string;
  title = 'diary' in hanData ? hanData.diary.title : '';
  title = 'heap' in hanData ? hanData.heap : '';
  const image = 'diary' in hanData ? hanData.diary.image : '';
  const notice =
    'chat' in hanData && hanData.chat !== null ? hanData.chat.notice : null;

  return { title, image: image ?? '', notice };
}
