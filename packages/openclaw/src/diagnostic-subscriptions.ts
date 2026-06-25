import { sharedSlot } from './shared-state.js';

export type TlonDiagnosticSubscriptionInstaller = () => () => void;

type TlonDiagnosticSubscription = {
  id: number;
  unsubscribe: () => void;
};

const diagnosticSubscriptionSlot = sharedSlot<TlonDiagnosticSubscription>(
  'telemetry.diagnosticEventsSubscription'
);
const diagnosticSubscriptionIdSlot = sharedSlot<number>(
  'telemetry.diagnosticEventsSubscription.nextId'
);

function nextDiagnosticSubscriptionId(): number {
  const nextId = (diagnosticSubscriptionIdSlot.get() ?? 0) + 1;
  diagnosticSubscriptionIdSlot.set(nextId);
  return nextId;
}

export function shouldInstallTlonDiagnosticSubscriptions(
  registrationMode: string | null | undefined
): boolean {
  return registrationMode === 'full';
}

export function installTlonDiagnosticSubscriptions(
  install: TlonDiagnosticSubscriptionInstaller
): () => void {
  diagnosticSubscriptionSlot.get()?.unsubscribe();

  const id = nextDiagnosticSubscriptionId();
  let unsubscribed = false;
  let installedUnsubscribe: () => void;
  try {
    installedUnsubscribe = install();
  } catch (error) {
    diagnosticSubscriptionSlot.set(null);
    throw error;
  }
  const unsubscribe = () => {
    if (unsubscribed) {
      return;
    }
    unsubscribed = true;
    installedUnsubscribe();
  };

  diagnosticSubscriptionSlot.set({ id, unsubscribe });

  return () => {
    if (diagnosticSubscriptionSlot.get()?.id !== id) {
      return;
    }
    try {
      unsubscribe();
    } finally {
      diagnosticSubscriptionSlot.set(null);
    }
  };
}

export function clearTlonDiagnosticSubscriptionsForTest(): void {
  diagnosticSubscriptionSlot.get()?.unsubscribe();
  diagnosticSubscriptionSlot.set(null);
  diagnosticSubscriptionIdSlot.set(null);
}
