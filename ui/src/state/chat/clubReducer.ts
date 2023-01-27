import { ClubAction } from '../../types/chat';
import { ChatState } from './type';

export default function clubReducer(action: ClubAction) {
  return (draft: ChatState) => {
    const {
      id,
      diff: { delta },
    } = action;
    const club = draft.multiDms[id];
    if (!('init' in delta) && !club) {
      return;
    }

    if ('init' in delta) {
      draft.multiDms[id] = delta.init;
    } else if ('meta' in delta) {
      club.meta = delta.meta;
    } else if ('hive' in delta) {
      const { add } = delta.hive;
      const ship = delta.hive.for;

      if (add && !club.hive.includes(ship)) {
        club.hive.push(ship);
      } else if (!add && club.hive.includes(ship)) {
        club.hive.splice(club.hive.indexOf(ship), 1);
      }
    } else if ('team' in delta) {
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
  };
}
