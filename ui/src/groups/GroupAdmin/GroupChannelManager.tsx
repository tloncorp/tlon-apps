import React from 'react';
import { Helmet } from 'react-helmet';
import { ViewProps } from '@/types/groups';
import { useRouteGroup, useGroup } from '@/state/groups/groups';
import AdminChannelList from './AdminChannels/AdminChannelList';

export default function GroupChannelManager(props: ViewProps) {
  const { title } = props;
  const flag = useRouteGroup();
  const group = useGroup(flag);

  return (
    <>
      <Helmet>
        <title>{group ? `${title} in ${group.meta.title}` : title}</title>
      </Helmet>
      <AdminChannelList />
    </>
  );
}
