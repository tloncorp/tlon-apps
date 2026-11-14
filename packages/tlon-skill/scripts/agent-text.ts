import { PlaintextPreviewConfig } from '@tloncorp/api/client/postContent';

// Agents read and act on ship names, so their flattened text keeps a mention
// as the `~ship` it is on the wire instead of the number people see.
export const AGENT_TEXT_CONFIG: PlaintextPreviewConfig = {
  ...PlaintextPreviewConfig.defaultConfig,
  mentionText: (contactId) => contactId,
};
