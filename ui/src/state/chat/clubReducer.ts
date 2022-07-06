import { ClubDelta } from '../../types/chat';
import { ChatState } from './type';

export default function clubReducer(clubId: string, delta: ClubDelta) {
  return (draft: ChatState) => {
    const club = draft.multiDms[clubId];
    if (!club) {
      return;
    }

    if ('team' in delta) {
      const { ok, ship } = delta.team;

      if (ok && club.hive.includes(ship)) {
        club.hive.splice(club.hive.indexOf(ship), 1);
        club.team.push(ship);
      } else if (!ok && club.hive.includes(ship)) {
        club.hive.splice(club.hive.indexOf(ship), 1);
      } else if (!ok && club.team.includes(ship)) {
        club.team.splice(club.team.indexOf(ship), 1);
      }
    }

    if ('hive' in delta) {
      const { add } = delta.hive;
      const ship = delta.hive.for;

      if (add && !club.hive.includes(ship)) {
        club.hive.push(ship);
      } else if (!add && club.hive.includes(ship)) {
        club.hive.splice(club.hive.indexOf(ship), 1);
      }
    }

    if ('meta' in delta) {
      club.meta = delta.meta;
    }
  };
}
