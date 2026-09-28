export const AGENT_TASK_PLAN_AUTO_PROVISION_COMPONENT_ID = 'auto-provision';
const AGENT_TASK_PLAN_AUTO_PROVISION_ACTION = 'tlon.provisionAgent';

type ComponentReference = {
  component: string;
  child?: string;
  children?: string[];
};

export function isComponentReachableFromRoot(
  rootId: string | null,
  targetId: string,
  components: ReadonlyMap<string, ComponentReference>
) {
  if (!rootId) return false;
  const pending = [rootId];
  const visited = new Set<string>();
  while (pending.length > 0) {
    const id = pending.pop();
    if (!id || visited.has(id)) continue;
    if (id === targetId) return true;
    visited.add(id);
    const component = components.get(id);
    if (!component) continue;
    if (component.child) pending.push(component.child);
    if (component.children) pending.push(...component.children);
  }
  return false;
}

export function claimAutomaticProvisionRetry(
  locks: Set<string>,
  surfaceId: string
) {
  if (locks.has(surfaceId)) return false;
  locks.add(surfaceId);
  return true;
}

export function isAutomaticProvisionControl(input: {
  componentId: string;
  actionName: string;
}) {
  return (
    input.componentId === AGENT_TASK_PLAN_AUTO_PROVISION_COMPONENT_ID &&
    input.actionName === AGENT_TASK_PLAN_AUTO_PROVISION_ACTION
  );
}

export function trackAutomaticProvisionReceipt(input: {
  observedReceipts: Set<string>;
  activeAttempts: Set<string>;
  surfaceId: string;
  consumed: boolean;
}) {
  if (input.consumed) {
    input.observedReceipts.add(input.surfaceId);
    return 'confirmed' as const;
  }
  if (input.observedReceipts.delete(input.surfaceId)) {
    input.activeAttempts.delete(input.surfaceId);
    return 'failed' as const;
  }
  return undefined;
}

export function shouldAttemptAutomaticProvision(input: {
  componentId: string;
  actionName: string;
  componentReachable: boolean;
  componentDisabled: boolean;
  selectionsPending: boolean;
  actionAvailable: boolean;
  consumed: boolean;
  attemptedThisMount: boolean;
}) {
  return (
    isAutomaticProvisionControl(input) &&
    input.componentReachable &&
    !input.componentDisabled &&
    !input.selectionsPending &&
    input.actionAvailable &&
    !input.consumed &&
    !input.attemptedThisMount
  );
}

export function clearFailedAutomaticProvision(
  failedSurfaceIds: string[],
  surfaceId: string
) {
  return failedSurfaceIds.filter((candidate) => candidate !== surfaceId);
}
