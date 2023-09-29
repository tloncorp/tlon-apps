import { PostEssay } from '@/types/channel';

export default function getKindDataFromEssay(essay: PostEssay | undefined): {
  title: string;
  image: string;
  notice?: null;
} {
  if (essay === undefined) {
    return { title: '', image: '' };
  }

  const { 'kind-data': kindData } = essay;

  if (kindData === undefined) {
    return { title: '', image: '' };
  }

  let title = '';
  let image = '';

  if ('diary' in kindData) {
    title = kindData.diary.title;
    image = kindData.diary.image ?? '';
  }

  if ('heap' in kindData) {
    title = kindData.heap;
  }

  const notice =
    'chat' in kindData && kindData.chat !== null ? kindData.chat.notice : null;

  return { title, image: image ?? '', notice };
}
