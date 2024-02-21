import React from 'react';

import Dialog from '@/components/Dialog';
import { useDismissNavigate } from '@/logic/routing';

import NewChannelForm from './NewChannelForm';

export default function NewChannelModal() {
  const dismiss = useDismissNavigate();

  const onOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      dismiss();
    }
  };

  return (
    <Dialog
      defaultOpen
      onOpenChange={onOpenChange}
      containerClass="w-full sm:max-w-lg"
      close="none"
    >
      <NewChannelForm />
    </Dialog>
  );
}
