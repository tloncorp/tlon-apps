import * as db from '@tloncorp/shared/db';
import create from 'zustand';

interface PersonalInviteSheetState {
  open: boolean;
  setOpen: (open: boolean) => void;
}

// Backs the PersonalInviteSheet that's rendered once at the desktop top-level
// drawer. Inner sidebars trigger it without prop drilling by calling
// `openPersonalInviteSheet`.
export const usePersonalInviteSheetStore = create<PersonalInviteSheetState>(
  (set) => ({
    open: false,
    setOpen: (open) => set({ open }),
  })
);

export function openPersonalInviteSheet() {
  db.hasViewedPersonalInvite.setValue(true);
  usePersonalInviteSheetStore.getState().setOpen(true);
}
