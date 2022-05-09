import React, { useState } from 'react';
import { useGroup, useGroupState, useRouteGroup } from '../state/groups';
import { allRanks, OpenCordon, Rank } from '../types/groups';
import { renderRank } from '../utils';

function RankPerm(props: { rank: Rank; flag: string; cordon: OpenCordon }) {
  const { rank, flag, cordon } = props;
  const banned = cordon.open.ranks;
  const isBanned = banned.includes(rank);
  const [checked, setChecked] = useState(isBanned);
  const onChange = () => {
    const state = useGroupState.getState();
    const func = checked ? state.unbanRanks : state.banRanks;
    func(flag, [rank]);
    setChecked((s) => !s);
  };

  return (
    <div className="flex justify-between">
      <span>{renderRank(rank, true)}</span>
      <input onChange={onChange} type="checkbox" checked={checked} />
    </div>
  );
}

function OpenPolicy(props: { flag: string; cordon: OpenCordon }) {
  const { flag, cordon } = props;
  const { ships, ranks } = cordon.open;
  return (
    <div className="flex flex-col space-y-2">
      <div className="space-y-2">
        <h4 className="font-bold">Banned Ships</h4>

        {ships.length > 0 ? (
          <ul className="w-56">
            {ships.map((s) => (
              <li className="flex w-56 justify-between" key={s}>
                <span className="text-mono">{s}</span>
                <button type="button">Unban</button>
              </li>
            ))}
          </ul>
        ) : (
          <div>No ships are currently banned</div>
        )}
        <div />
      </div>
      <div className="space-y-2">
        <h4 className="font-bold">Banned Ranks</h4>
        {allRanks.map((rank) => (
          <RankPerm rank={rank} cordon={cordon} flag={flag} />
        ))}
      </div>
    </div>
  );
}

export default function Policy() {
  const flag = useRouteGroup();
  const { cordon } = useGroup(flag);
  return (
    <div className="w-100 space-y-4 p-4">
      <h2 className="text-lg font-bold">Policy</h2>
      {'open' in cordon ? (
        <OpenPolicy flag={flag} cordon={cordon} />
      ) : (
        <div>Shut Policy</div>
      )}
    </div>
  );
}
