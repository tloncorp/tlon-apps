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
  // contact-store prepends "/ship/" to each group flag added to it, which is the correct URL path in groups 1, but not here
  const noShipGroupFlag = groupFlag.replace('/ship/', '');
  const group = useGroup(noShipGroupFlag);
  const location = useLocation();
  const gang = useGang(noShipGroupFlag);
  const navigate = useNavigate();
  const modalNavigate = useModalNavigate();

  const data = {
    image: '',
    title: '',
  };

  if (group) {
    data.image = group.meta.image;
    data.title = group.meta.title;
  } else if (gang.preview) {
    data.image = gang.preview?.meta.image;
    data.title = gang.preview?.meta.title;
  }

  const onGroupClick = () => {
    if (group) {
      navigate(`/groups/${noShipGroupFlag}`);
    } else {
      modalNavigate(`/gangs/${noShipGroupFlag}`, {
        state: { backgroundLocation: location },
      });
    }
  };

  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <div onClick={onGroupClick} className="cursor-pointer">
          <GroupAvatar {...group?.meta} image={data.image} size="h-14 w-14" />
        </div>
      </Tooltip.Trigger>
      <Tooltip.Content
        side="bottom"
        className="rounded bg-white p-2 font-semibold drop-shadow-md"
      >
        {data.title && data.title.length ? data.title : noShipGroupFlag}
      </Tooltip.Content>
    </Tooltip.Root>
  );
}
