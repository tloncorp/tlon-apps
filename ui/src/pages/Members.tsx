import React from 'react';
import { useGroup, useRouteGroup } from '../state/groups';

function Member(props: { ship: string }) {
  const { ship } = props;

  return <li className="text-mono">{ship}</li>;
}

export default function Members() {
  const flag = useRouteGroup();
  const group = useGroup(flag);

  const ships = Object.keys(group.fleet);
  return (
    <div className="p-2">
      <h1>Members</h1>
      <ul>
        {ships.map((ship) => (
          <Member key={ship} ship={ship} />
        ))}
      </ul>
    </div>
  );
}
