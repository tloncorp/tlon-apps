import React from 'react';
import { useParams } from 'react-router-dom';
import { useCharge } from '@/state/docket';
import { usePike } from '@/state/kiln';
import { useDismissNavigate } from '@/logic/routing';
import Dialog, { DialogContent } from '../Dialog';
import AppInfo from './AppInfo';

export default function TileInfo() {
  const { desk } = useParams<{ desk: string }>();
  const dismiss = useDismissNavigate();
  const charge = useCharge(desk ?? '');
  const pike = usePike(desk ?? '');

  if (!charge) {
    return null;
  }

  const onOpenChange = (open: boolean) => {
    if (!open) {
      dismiss();
    }
  };

  return (
    <Dialog defaultOpen modal onOpenChange={onOpenChange}>
      <DialogContent>
        <AppInfo pike={pike} docket={charge} />
      </DialogContent>
    </Dialog>
  );
}
