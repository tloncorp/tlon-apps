import React from "react";
import * as DialogPrimitive from '@radix-ui/react-dialog';
import Dialog, { DialogContent } from '../../components/Dialog';
import PencilIcon from '../../components/icons/PencilIcon';

interface EditChannelNameModalProps {
  editIsOpen: boolean;
  setEditIsOpen: (open: boolean) => void;
}

export default function EditChannelNameModal({
  editIsOpen,
  setEditIsOpen,
}: EditChannelNameModalProps) {
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