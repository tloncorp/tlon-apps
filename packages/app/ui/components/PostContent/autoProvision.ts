export const AGENT_TASK_PLAN_AUTO_PROVISION_COMPONENT_ID = 'auto-provision';

export function shouldAttemptAutomaticProvision(input: {
  componentId: string;
  actionName: string;
  selectionsPending: boolean;
  actionAvailable: boolean;
  consumed: boolean;
  attemptedThisMount: boolean;
}) {
  return (
    input.componentId === AGENT_TASK_PLAN_AUTO_PROVISION_COMPONENT_ID &&
    input.actionName === 'tlon.provisionAgent' &&
    !input.selectionsPending &&
    input.actionAvailable &&
    !input.consumed &&
    !input.attemptedThisMount
  );
}
