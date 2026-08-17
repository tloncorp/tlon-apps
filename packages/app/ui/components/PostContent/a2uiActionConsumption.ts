import { A2UI } from '@tloncorp/shared/logic';

/**
 * Only actions that submit an owner response are one-shot. Navigation and
 * other client-local actions remain available after they complete.
 */
export function isConsumableA2UIAction(action: A2UI.ButtonAction): boolean {
  return (
    action.event.name === A2UI.action.sendMessage ||
    action.event.name === A2UI.action.provisionAgent
  );
}
