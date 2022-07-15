import React, { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router';
import Dialog, { DialogContent } from '@/components/Dialog';
import { useDismissNavigate } from '@/logic/routing';
import {
  useGang,
  useGroup,
  useGroupState,
  useRouteGroup,
} from '@/state/groups';
import GroupSummary from '../GroupSummary';

export default function JoinGroupModal() {
  const navigate = useNavigate();
  const flag = useRouteGroup();
  const gang = useGang(flag);
  const group = useGroup(flag);
  const dismiss = useDismissNavigate();

  useEffect(() => {
    if (group) {
      navigate(`/groups/${flag}`);
    }
  }, [group, flag, navigate]);

  const join = useCallback(async () => {
    await useGroupState.getState().join(flag, true);
    dismiss();
  }, [flag]);

  const reject = useCallback(() => {
    // TODO: show the Reject Confirm modal
    // TODO: Liam is working on implementing the Reject Gang endpoint
    console.log('reject ...');
  }, [flag]);

  return (
    <Dialog defaultOpen onOpenChange={() => dismiss()}>
      <DialogContent containerClass="w-full max-w-md">
        <div className="space-y-6">
          <h2 className="text-lg font-bold">Join a Group</h2>
          <GroupSummary flag={flag} {...gang.preview} />
          <p>{gang.preview?.meta.description}</p>
          <div className="flex items-center justify-end space-x-2">
            {
              gang.invite ?
                <button
                  className="button bg-red-soft text-red"
                  onClick={reject}
                >
                  Reject Invite
                </button>
                : null
            }
            <button
              className="button bg-blue-soft text-blue ml-2"
              onClick={join}
            >
              Join
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
