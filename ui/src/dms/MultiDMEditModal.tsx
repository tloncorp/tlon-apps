import React from 'react';
import Dialog, { DialogContent } from '../components/Dialog';
import MultiDMInfoForm from '../components/MultiDMInfoForm/MultiDMInfoForm';

interface MultiDMEditModalProps {
  editIsOpen: boolean;
  setEditIsOpen: (open: boolean) => void;
}

export default function MultiDMEditModal({
  editIsOpen,
  setEditIsOpen,
}: MultiDMEditModalProps) {
  return (
    <Dialog open={editIsOpen} onOpenChange={setEditIsOpen}>
      <DialogContent showClose className="sm:max-w-lg">
        <div className="sm:w-96">
          <header className="flex items-center ">
            <div className="text-xl font-bold">Edit Chat Info</div>
          </header>
        </div>
        <MultiDMInfoForm setEditIsOpen={setEditIsOpen} />
      </DialogContent>
    </Dialog>
  );
}
