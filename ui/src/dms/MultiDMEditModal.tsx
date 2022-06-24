import React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useForm } from 'react-hook-form';
import Dialog, { DialogContent } from '../components/Dialog';
import MultiDMInfoForm from '../components/MultiDMInfoForm/MultiDMInfoForm';

interface MultiDMInfoSchema {
  name: string;
  color: string;
}

interface MultiDMEditModalProps {
  editIsOpen: boolean;
  setEditIsOpen: (open: boolean) => void;
}

export default function MultiDMEditModal({
  editIsOpen,
  setEditIsOpen,
}: MultiDMEditModalProps) {
  const defaultValues: MultiDMInfoSchema = {
    name: 'Pain Gang',
    color: '#000000',
  };

  const { handleSubmit, register } = useForm<MultiDMInfoSchema>({
    defaultValues,
  });
  return (
    <Dialog open={editIsOpen} onOpenChange={setEditIsOpen}>
      <DialogContent showClose className="sm:max-w-lg">
        <div className="sm:w-96">
          <header className="flex items-center ">
            <div className="text-xl font-bold">Edit Chat Info</div>
          </header>
        </div>

        <MultiDMInfoForm register={register} />
      </DialogContent>
    </Dialog>
  );
}
