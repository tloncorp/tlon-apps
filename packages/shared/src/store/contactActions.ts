import * as api from '../api';
import * as db from '../db';

// export async function blockUser(userId: string) {
//   // optimistic update
//   await db.updateChannel({ id: channel.id, isDmInvite: false });

//   try {
//     await api.blockUser(userId);
//   } catch (e) {
//     console.error('Failed to respond to dm invite', e);
//     // rollback optimistic update
//     await db.updateChannel({ id: channel.id, isDmInvite: true });
//   }
// }

// export async function unblockUser(userId: string) {
//   // optimistic update
//   await db.updateChannel({ id: channel.id, isDmInvite: false });

//   try {
//     await api.unblockUser(userId);
//   } catch (e) {
//     console.error('Failed to respond to dm invite', e);
//     // rollback optimistic update
//     await db.updateChannel({ id: channel.id, isDmInvite: true });
//   }
// }
