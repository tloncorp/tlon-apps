import React from 'react';
import * as db from '@db';

export const StreamContext = React.createContext<db.TabSettings>({
  view: {},
  query: {
    byAuthors: [],
    inChannels: [],
    ofType: [],
    groupBy: 'post',
    inGroups: [],
    containsText: [],
  },
});
