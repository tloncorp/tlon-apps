import useNest from '@/logic/useNest';
import { nestToFlag } from '@/logic/utils';
import { useCurio } from '@/state/heap/heap';
import { useParams } from 'react-router';

export default function useCurioFromParams() {
  const nest = useNest();
  const { idCurio } = useParams();
  const [, chFlag] = nestToFlag(nest);
  const curioObject = useCurio(chFlag, idCurio || '');
  const curio = curioObject ? curioObject[1] : null;
  const time = curioObject ? curioObject[0] : null;

  return {
    time,
    curio,
  };
}
