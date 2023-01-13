// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference types="@welldone-software/why-did-you-render" />

import * as React from 'react';
// eslint-disable-next-line import/no-extraneous-dependencies
import wdyr from '@welldone-software/why-did-you-render';

wdyr(React, {
  include: [/Sidebar/, /GroupsList/],
  exclude: [/^BrowserRouter/, /^Link/, /^Route/],
  trackHooks: true,
  trackAllPureComponents: true,
});
