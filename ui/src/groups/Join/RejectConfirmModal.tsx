import React, { useCallback, useEffect } from 'react';
import Dialog, { DialogContent } from '@/components/Dialog';
import { useDismissNavigate } from '@/logic/routing';
import {
  useGang,
  useRouteGroup,
} from '@/state/groups';
import { getGroupPrivacy, toTitleCase } from '@/logic/utils';

const PRIVATE_COPY = "If you reject this invite, you'll need to send a membership request in order to join this group.";
const SECRET_COPY = "You won't be able to find, view, or rediscover this group if you reject this invite. You'll explicitly need to be re-invited in order to view it.";

const COPY: Record<string, string>  = {
  'private': PRIVATE_COPY,
  'secret': SECRET_COPY
}

export default function RejectConfirmModal() {
  const flag = useRouteGroup();
  const gang = useGang(flag);
  const dismiss = useDismissNavigate();
  const privacy = gang.preview?.cordon ? getGroupPrivacy(gang.preview?.cordon) : 'public';

  const cancel = useCallback(async () => {
    dismiss();
  }, [flag]);

  const reject = useCallback(() => {
    // TODO: show the Reject Confirm modal
    // TODO: Liam is working on implementing the Reject Gang endpoint
    console.log('reject ...');
    dismiss();
  }, [flag]);

  return (
    <Dialog defaultOpen onOpenChange={() => dismiss()}>
      <DialogContent containerClass="w-full max-w-md">
        <div className="space-y-6">
          <h2 className="text-lg font-bold">Reject {toTitleCase(privacy)} Group Invite?</h2>
          <p>Are you sure you'd like to reject your invite to &quot;{gang.preview?.meta.title}&quot;?</p>
          <p>{COPY[privacy]}</p>
          <div className="flex items-center justify-end space-x-2">
            <button
              className="button bg-gray-50 text-gray-800"
              onClick={cancel}
            >
              Cancel
            </button>
            <button
              className="button bg-red-soft text-red ml-2"
              onClick={reject}
            >
              Reject Invite
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
