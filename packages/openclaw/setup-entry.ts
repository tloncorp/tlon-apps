import { defineSetupPluginEntry } from 'openclaw/plugin-sdk/core';

import { tlonPlugin } from './src/channel.js';

const tlonSetupEntry = defineSetupPluginEntry(tlonPlugin);

export default {
  ...tlonSetupEntry,
  kind: 'bundled-channel-setup-entry' as const,
  loadSetupPlugin: () => tlonPlugin,
};
