import {
  PlaintextPreviewConfig,
  shipMentionText,
} from '@tloncorp/api/client/postContent';

// Agents read and act on ship names, so their flattened text keeps a mention
// as its `~ship` instead of the number people see.
export const AGENT_TEXT_CONFIG: PlaintextPreviewConfig = {
  ...PlaintextPreviewConfig.defaultConfig,
  mentionText: shipMentionText,
};
