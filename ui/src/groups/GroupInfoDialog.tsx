import React from 'react';
import GroupAvatar from './GroupAvatar';
import { useGroup, useRouteGroup } from '../state/groups';
import { useDismissNavigate } from '../logic/routing';
import Dialog, {
  DialogClose,
  DialogContent,
  DialogTitle,
} from '../components/Dialog';

export default function GroupInfoDialog() {
  const dismiss = useDismissNavigate();
  const flag = useRouteGroup();
  const group = useGroup(flag);
  const meta = group?.meta;

  const onOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      dismiss();
    }
  };

  if (!meta) {
    return null;
  }

  return (
    <Dialog defaultOpen onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-lg">
        <header className="flex items-center">
          <DialogTitle className="text-lg font-bold">Group Info</DialogTitle>
        </header>
        <div className="mt-6">
          <div className="flex flex-col items-center">
            <GroupAvatar img={meta.image} size="h-20 w-20" />
            <div className="my-4 text-center">
              <h2 className="center mb-2 font-semibold">{meta.title}</h2>
              {/* Current group meta object doesn't contain public/private info  */}
              <h3 className="text-base text-gray-600">Private Group</h3>
            </div>
            <p className="w-full leading-5">{meta.description}</p>
          </div>
        </div>
        <footer className="mt-8 flex items-center">
          <DialogClose asChild>
            <button className="button ml-auto">Close</button>
          </DialogClose>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
