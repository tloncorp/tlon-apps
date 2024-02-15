import { useCharge } from '@/state/docket';
import { usePike } from '@/state/kiln';
import React from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import Dialog, { DialogContent } from '../Dialog';
import AppInfo from './AppInfo';

export default function TileInfo() {
  const { desk } = useParams<{ desk: string }>();
  const navigate = useNavigate();
  const {
    state: { backgroundLocation },
  } = useLocation();
  const charge = useCharge(desk ?? '');
  const pike = usePike(desk ?? '');

  if (!charge) {
    return null;
  }

  const onOpenChange = (open: boolean) => {
    if (!open) {
      navigate('/grid', { state: { backgroundLocation } });
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
