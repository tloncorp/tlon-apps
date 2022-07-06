import React from 'react';
import { useForm } from 'react-hook-form';
import { useParams } from 'react-router-dom';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useGroup, useRouteGroup } from '@/state/groups';
import Dialog, { DialogContent } from '@/components/Dialog';
import { useChannelFlag } from '@/hooks';

interface EditChannelNameModalProps {
  editIsOpen: boolean;
  setEditIsOpen: (open: boolean) => void;
}

export default function EditChannelNameModal({
  editIsOpen,
  setEditIsOpen,
}: EditChannelNameModalProps) {
  const groupFlag = useRouteGroup();
  const group = useGroup(groupFlag);

  // const { handleSubmit, register, setValue, watch } = useForm<GroupMeta>({
  //   defaultValues,
  // });
  return (
    <Dialog open={editIsOpen} onOpenChange={setEditIsOpen}>
      <DialogContent showClose containerClass="max-w-lg">
        <div className="sm:w-96">
          <header className="flex items-center ">
            <h2 className="text-xl font-bold">Edit Name</h2>
          </header>
        </div>
      </DialogContent>
    </Dialog>
  );
}
