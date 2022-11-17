import React, { useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router';
import { ViewProps } from '@/types/groups';
import { useRouteGroup, useGroup, useAmAdmin } from '@/state/groups/groups';
import AdminChannelList from './AdminChannels/AdminChannelList';

export default function GroupChannelManager({ title }: ViewProps) {
  const navigate = useNavigate();
  const flag = useRouteGroup();
  const group = useGroup(flag);
  const amAdmin = useAmAdmin(flag);

  useEffect(() => {
    if (!amAdmin) {
      navigate('../');
    }
  }, [amAdmin, navigate]);

  return (
    <>
      <Helmet>
        <title>
          {group ? `Channels in ${group.meta.title} ${title}` : title}
        </title>
      </Helmet>
      <AdminChannelList />
    </>
  );
}
