import { Club } from '@/types/dms';

export default function emptyMultiDm(): Club {
  return {
    hive: [],
    team: [],
    meta: {
      title: '',
      description: '',
      image: '',
      cover: '',
    },
  };
}
