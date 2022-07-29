import React from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import GroupAvatar from '@/groups/GroupAvatar';
import { useNavigate, useLocation } from 'react-router';
import { useModalNavigate } from '@/logic/routing';
import { useGang, useGroup } from '@/state/groups';

interface FavoriteGroupProps {
  groupFlag: string;
}

export default function FavoriteGroup({ groupFlag }: FavoriteGroupProps) {
  const group = useGroup(groupFlag);
  const location = useLocation();
  const gang = useGang(groupFlag);
  const navigate = useNavigate();
  const modalNavigate = useModalNavigate();

  const data = {
    image: '',
    title: '',
    color: '',
  };

  if (group) {
    data.image = group.meta.image;
    data.title = group.meta.title;
    data.color = group.meta.color;
  } else if (gang.preview) {
    data.image = gang.preview?.meta.image;
    data.title = gang.preview?.meta.title;
    data.color = gang.preview?.meta.color;
  }

  const onGroupClick = () => {
    if (group) {
      navigate(`/groups/${groupFlag}`);
    } else {
      modalNavigate(`/gangs/${groupFlag}`, {
        state: { backgroundLocation: location },
      });
    }
  };

  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <div onClick={onGroupClick} className="cursor-pointer">
          <GroupAvatar image={data.image} color={data.color} size="h-14 w-14" />
        </div>
      </Tooltip.Trigger>
      <Tooltip.Content
        side="bottom"
        className="rounded bg-white p-2 font-semibold drop-shadow-md"
      >
        {data.title && data.title.length ? data.title : groupFlag}
      </Tooltip.Content>
    </Tooltip.Root>
  );
}
