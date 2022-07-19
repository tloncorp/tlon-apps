import React, { useCallback, useEffect } from 'react';
import Dialog, { DialogContent } from '@/components/Dialog';
import { useDismissNavigate, useModalNavigate } from '@/logic/routing';
import {
  useGang,
  useGroup,
  useGroupState,
  useRouteGroup,
} from '@/state/groups';
import { getGroupPrivacy } from '@/logic/utils';
import { useLocation } from 'react-router';
import GroupSummary from '../GroupSummary';

export default function JoinGroupModal() {
  const location = useLocation();
  const navigate = useModalNavigate();
  const flag = useRouteGroup();
  const gang = useGang(flag);
  const group = useGroup(flag);
  const dismiss = useDismissNavigate();
  const privacy = gang.preview?.cordon
    ? getGroupPrivacy(gang.preview?.cordon)
    : 'public';

  useEffect(() => {
    if (group) {
      navigate(`/groups/${flag}`);
    }
  }, [group, flag, navigate]);

  const join = useCallback(async () => {
    await useGroupState.getState().join(flag, true);
    dismiss();
  }, [dismiss, flag]);

  const reject = useCallback(() => {
    if (privacy === 'public') {
      // TODO: Liam is working on implementing the Reject Gang endpoint
      dismiss();
      return;
    }

    navigate(`/gangs/${flag}/reject`, {
      state: { backgroundLocation: location },
    });
  }, [dismiss, flag, location, navigate, privacy]);

  return (
    <Dialog defaultOpen onOpenChange={() => dismiss()}>
      <DialogContent containerClass="w-full max-w-md">
        <div className="space-y-6">
          <h2 className="text-lg font-bold">Join a Group</h2>
          <GroupSummary flag={flag} {...gang.preview} />
          <p>{gang.preview?.meta.description}</p>
          <div className="flex items-center justify-end space-x-2">
            {gang.invite ? (
              <button className="button bg-red-soft text-red" onClick={reject}>
                Reject Invite
              </button>
            ) : null}
            <button
              className="button ml-2 bg-blue-soft text-blue"
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
