import type { SystemContact } from '../types';

export type SystemContactsProvider = () => Promise<SystemContact[]>;

const emptySystemContactsProvider: SystemContactsProvider = async () => [];
let systemContactsProvider: SystemContactsProvider = emptySystemContactsProvider;

export function configureSystemContactsProvider(
  provider?: SystemContactsProvider | null
): void {
  systemContactsProvider = provider ?? emptySystemContactsProvider;
}

export async function getSystemContacts(): Promise<SystemContact[]> {
  return systemContactsProvider();
}
