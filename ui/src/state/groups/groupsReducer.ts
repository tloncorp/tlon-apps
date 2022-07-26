import {
  CordonDiff,
  Fleet,
  FleetDiff,
  Group,
  GroupUpdate,
} from '../../types/groups';
import { GroupState } from './type';

function reduceCordon(draft: Group, diff: CordonDiff) {
  const d = diff.cordon;

  if ('open' in d && 'open' in draft.cordon) {
    const { open } = draft.cordon;

    if ('add-ships' in d.open) {
      open.ships = [...open.ships, ...d.open['add-ships']];
    } else if ('del-ships' in d.open) {
      const ships = d.open['del-ships'];
      open.ships = open.ships.filter((s) => !ships.includes(s));
    } else if ('add-ranks' in d.open) {
      open.ranks = [...open.ranks, ...d.open['add-ranks']];
    } else if ('del-ranks' in d.open) {
      const ships = d.open['del-ranks'];
      open.ranks = open.ranks.filter((s) => !ships.includes(s));
    }
  } else if ('shut' in d && 'shut' in draft.cordon) {
    if ('add-ships' in d.shut) {
      draft.cordon.shut = [...draft.cordon.shut, ...d.shut['add-ships']];
    } else if ('del-ships' in d.shut) {
      const ships = d.shut['del-ships'];
      draft.cordon.shut = draft.cordon.shut.filter((s) => !ships.includes(s));
    }
  } else if ('swap' in d) {
    draft.cordon = d.swap;
  }
}

function reduceFleet(draft: Group, diff: FleetDiff) {
  const { ships, diff: d } = diff.fleet;
  if ('add' in d) {
    draft.fleet = {
      ...draft.fleet,
      ...ships.reduce((fleet, ship) => {
        // eslint-disable-next-line no-param-reassign
        fleet[ship] = {
          joined: Date.now(),
          sects: [],
        };
        return fleet;
      }, {} as Fleet),
    };
  } else if ('del' in d) {
    ships.forEach((ship) => {
      delete draft.fleet[ship];
    });
  } else if ('add-sects' in d) {
    ships.forEach((ship) => {
      const vessel = draft.fleet[ship];
      vessel.sects = [...vessel.sects, ...d['add-sects']];
    });
  } else if ('del-sects' in d) {
    ships.forEach((ship) => {
      const vessel = draft.fleet[ship];
      vessel.sects = vessel.sects.filter((s) => !d['del-sects'].includes(s));
    });
  }
}

export default function groupsReducer(flag: string, data: GroupUpdate) {
  return (draft: GroupState) => {
    const { diff } = data;
    const group = draft.groups[flag];

    if ('channel' in diff) {
      const { flag: f, diff: d } = diff.channel;
      if ('add' in d) {
        group.channels[f] = d.add;
      } else if ('del' in d) {
        delete group.channels[f];
      } else if ('add-zone' in d) {
        group.channels[f].zone = d['add-zone'];
      } else if ('del-zone' in d) {
        group.channels[f].zone = null;
      } else if ('add-sects' in d) {
        group.channels[f].readers = [
          ...group.channels[f].readers,
          ...d['add-sects'],
        ];
      } else if ('del-sects' in d) {
        group.channels[f].readers = group.channels[f].readers.filter(
          (s) => !d['del-sects'].includes(s)
        );
      } else if ('join' in d) {
        group.channels[f].join = d.join;
      }
    } else if ('fleet' in diff) {
      reduceFleet(group, diff);
    } else if ('cabal' in diff) {
      const { diff: d, sect } = diff.cabal;
      if ('add' in d) {
        group.cabals[sect] = { meta: d.add };
      } else if ('del' in d) {
        delete group.cabals[sect];
      }
    } else if ('cordon' in diff) {
      reduceCordon(group, diff);
    } else if ('meta' in diff) {
      group.meta = diff.meta;
    } else if ('del' in diff) {
      delete draft.groups[flag];
    } else if ('zone' in diff) {
      const { zone: f, delta: d } = diff.zone;
      if ('add' in d) {
        group.zones[f] = d.add;
      } else if ('del' in d) {
        delete group.zones[f];
      }
    } else {
      // console.log('unreachable');
    }
  };
}
