import React from 'react';
import {MenuSheet, MenuSheetSettings} from './MenuSheet';

const config: MenuSheetSettings = {
  title: 'Tlon',
  subtitle: 'Quick Actions',
  buttonGroups: [
    {
      external: true,
      items: [
        {title: 'Invite people', subtitle: 'Invite people to this group'},
      ],
    },
    {
      items: [
        {
          title: 'Group settings',
          subtitle: 'Configure group details and privacy',
        },
        {title: 'Group members', subtitle: 'View all members and roles'},
        {
          title: 'Channels',
          subtitle:
            'View all channels and sections you have visibility towards',
        },
        {
          title: 'Group notification settings',
          subtitle: 'Configure notifications for this group',
        },
      ],
    },
    {destructive: true, items: [{title: 'Leave group'}]},
  ],
};

export default function () {
  return <MenuSheet open={true} menu={config} />;
}
