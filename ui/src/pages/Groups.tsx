import React from 'react';
import { Outlet, useParams } from 'react-router';
import { Link } from 'react-router-dom';
import { useGroup } from '../state/groups';
import { Group } from '../types/groups';

function ChannelList(props: { group: Group; flag: string }) {
  const { group, flag } = props;
  const channels = Object.keys(group.channels);
  return (
    <div className="">
      <h1>Channels</h1>
      <ul className="p-2">
        {channels.map((channel) => (
          <li key={channel}>
            <Link to={`/groups/${flag}/channels/${channel}`}>{channel}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Groups() {
  const { ship, name } = useParams();
  const flag = `${ship!}/${name!}`;

  const group = useGroup(flag!);
  console.log(group);
  return (
    <div className="flex grow">
      <div className="w-56 p-2 border-r">
        <h1>{group.meta.title}</h1>
        <p>{group.meta.description}</p>
        <ChannelList group={group} flag={flag} />
      </div>
      <Outlet />
    </div>
  );
}

export default Groups;
