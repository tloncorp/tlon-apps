import { useStore } from '@tloncorp/app/ui';
import { useCallback, useEffect, useState } from 'react';

import * as ContactHelpers from '../lib/contactsHelpers';
import { useContactPermissions } from './useContactPermissions';

// TODO: Delete

// export function useCheckSystemContacts() {
//   const perms = useContactPermissions();
//   const [didLoadInitial, setDidLoadInitial] = useState(false);
//   const store = useStore();

//   const loadSystemContacts = useCallback(async () => {
//     const systemContacts = await ContactHelpers.getSystemContactBook();
//     await store.importSystemContactBook(systemContacts);
//   }, [store]);

//   // If we can ask, do
//   useEffect(() => {
//     if (!perms.isLoading && perms.canAskPermission) {
//       perms.requestPermissions();
//     }
//   }, [perms]);

//   useEffect(() => {
//     if (perms.status === 'granted' && !didLoadInitial) {
//       loadSystemContacts();
//       setDidLoadInitial(true);
//     }
//   }, [didLoadInitial, loadSystemContacts, perms.status]);

//   return { didLoadInitial };
// }
