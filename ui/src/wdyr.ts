// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference types="@welldone-software/why-did-you-render" />

import * as React from 'react';
// eslint-disable-next-line import/no-extraneous-dependencies
import wdyr from '@welldone-software/why-did-you-render';

wdyr(React, {
  include: [
    /^RoutedApp/,
    /^App$/,
    /^GroupsRoutes/,
    /^Sidebar/,
    /^GroupSidebar/,
  ],
  exclude: [/^Link/, /^Route/, /^BrowserRouter/],
  trackHooks: true,
  trackAllPureComponents: true,
});
