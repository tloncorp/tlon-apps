import { ViewProps } from '@tloncorp/shared/dist/urbit/groups';
import React from 'react';

import WidgetDrawer from '@/components/WidgetDrawer';
import { useDismissNavigate } from '@/logic/routing';

import { useRouteGroup } from '../../state/groups/groups';
import ChannelList from '../GroupSidebar/ChannelList';

export default function GroupInfo({ title }: ViewProps) {
  const flag = useRouteGroup();
  const dismiss = useDismissNavigate();

  const onOpenChange = (open: boolean) => {
    if (!open) {
      dismiss();
    }
  };

  return (
    <WidgetDrawer open={true} onOpenChange={onOpenChange} className="h-[70vh]">
      <ChannelList noScroller={true} flag={flag} />
    </WidgetDrawer>
  );
}
