import { PostEssay } from '@/types/channel';

export default function getHanDataFromEssay(essay: PostEssay | undefined): {
  title: string;
  image: string;
  notice?: null;
} {
  if (essay === undefined) {
    return { title: '', image: '' };
  }

  const { 'han-data': hanData } = essay;

  if (hanData === undefined) {
    return { title: '', image: '' };
  }

  let title = '';
  let image = '';

  if ('diary' in hanData) {
    title = hanData.diary.title;
    image = hanData.diary.image ?? '';
  }

  if ('heap' in hanData) {
    title = hanData.heap;
  }

  const notice =
    'chat' in hanData && hanData.chat !== null ? hanData.chat.notice : null;

  return { title, image: image ?? '', notice };
}
