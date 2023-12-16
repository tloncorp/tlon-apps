import type { Club } from '@/types/dms';
import useShipNameList from './useShipNames';

type Props = {
  whom?: string;
  club: Club;
};

export default function useClubName({ whom, club }: Props) {
  const shipNames = useShipNameList({ ships: club.team.concat(club.hive) });
  return club.meta.title || shipNames || (whom ?? '');
}
