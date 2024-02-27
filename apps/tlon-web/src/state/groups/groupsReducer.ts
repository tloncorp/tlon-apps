import {
  CordonDiff,
  Fleet,
  FleetDiff,
  Group,
  GroupDiff,
  GroupUpdate,
} from '@tloncorp/shared/dist/urbit/groups';

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
      const { kind, ships } = d.shut['add-ships'];
      draft.cordon.shut[kind] = [...draft.cordon.shut[kind], ...ships];
    } else if ('del-ships' in d.shut) {
      const { kind, ships } = d.shut['del-ships'];
      draft.cordon.shut[kind] = draft.cordon.shut[kind].filter(
        (s) => !ships.includes(s)
      );
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
    if ('shut' in draft.cordon) {
      const addsRemoved = draft.cordon.shut.pending.filter((s) =>
        ships.includes(s)
      );
      draft.cordon.shut.pending = addsRemoved;
    }
  } else if ('del' in d) {
    ships.forEach((ship) => {
      delete draft.fleet[ship];
    });
  } else if ('add-sects' in d) {
    ships.forEach((ship) => {
      const vessel = draft.fleet[ship] || { sects: [], joined: 0 };
      vessel.sects = [...vessel.sects, ...d['add-sects']];
    });
  } else if ('del-sects' in d) {
    ships.forEach((ship) => {
      const vessel = draft.fleet[ship] || { sects: [], joined: 0 };
      vessel.sects = vessel.sects.filter((s) => !d['del-sects'].includes(s));
    });
  }
}

export default function groupsReducer(flag: string, data: GroupUpdate) {
  return (draft: GroupState) => {
    const { diff } = data;
    const group = draft.groups[flag];

    if ('channel' in diff) {
      const { nest, diff: d } = diff.channel;
      if ('add' in d) {
        group.channels[nest] = d.add;

        if (!group.zones[d.add.zone].idx.includes(nest)) {
          group.zones[d.add.zone].idx.push(nest);
        }
      } else if ('edit' in d) {
        group.channels[nest] = d.edit;

        if (!group.zones[d.edit.zone].idx.includes(nest)) {
          group.zones[d.edit.zone].idx.push(nest);
        }
      } else if ('del' in d) {
        const { zone } = group.channels[nest];
        group.zones[zone || 'default'].idx = group.zones[
          zone || 'default'
        ].idx.filter((n) => n !== nest);
        delete group.channels[nest];
      } else if ('zone' in d) {
        const oldZone = group.channels[nest].zone || 'default';
        group.zones[oldZone].idx = group.zones[oldZone].idx.filter(
          (n) => n !== nest
        );
        group.zones[d.zone].idx.splice(0, 0, nest);
        group.channels[nest].zone = d.zone;
      } else if ('add-sects' in d) {
        group.channels[nest].readers = [
          ...group.channels[nest].readers,
          ...d['add-sects'],
        ];
      } else if ('del-sects' in d) {
        group.channels[nest].readers = group.channels[nest].readers.filter(
          (s) => !d['del-sects'].includes(s)
        );
      } else if ('join' in d) {
        group.channels[nest].join = d.join;
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
        // TODO: what should `idx` be populated with?
        group.zones[f] = { meta: d.add, idx: [] };
        group['zone-ord'].splice(1, 0, f);
      } else if ('del' in d) {
        delete group.zones[f];
        group['zone-ord'] = group['zone-ord'].filter((nest) => nest !== f);
      } else if ('edit' in d) {
        group.zones[f].meta = d.edit;
      } else if ('mov-nest' in d) {
        group.zones[f].idx = group.zones[f].idx.filter(
          (nest) => nest !== d['mov-nest'].nest
        );
        group.zones[f].idx.splice(d['mov-nest'].idx, 0, d['mov-nest'].nest);
      } else if ('mov' in d) {
        group['zone-ord'] = group['zone-ord'].filter((zone) => zone !== f);
        group['zone-ord'].splice(d.mov, 0, f);
      }
    } else if ('secret' in diff) {
      group.secret = diff.secret;
    } else {
      // console.log('unreachable');
    }
  };
}
