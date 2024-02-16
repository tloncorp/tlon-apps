import { Outlet, useParams } from 'react-router';

import type { AnalyticsChannelType } from '@/logic/analytics';
import { useGroupsAnalyticsEvent } from '@/logic/useAnalyticsEvent';
import { useRouteGroup } from '@/state/groups';

type Props = {
  type: AnalyticsChannelType;
};

function GroupChannel({ type }: Props) {
  const groupFlag = useRouteGroup();
  const { chShip, chName } = useParams();
  const chFlag = `${chShip}/${chName}`;

  useGroupsAnalyticsEvent({
    name: 'open_channel',
    leaveName: 'leave_channel',
    groupFlag,
    chFlag,
    channelType: type,
  });

  return <Outlet />;
}

export default GroupChannel;
