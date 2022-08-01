import React, { useCallback, useEffect } from 'react';
import Dialog, { DialogContent } from '@/components/Dialog';
import { useDismissNavigate, useModalNavigate } from '@/logic/routing';
import {
  useGang,
  useGroup,
  useGroupState,
  useRouteGroup,
} from '@/state/groups';
import { useLocation, useNavigate } from 'react-router';
import { getGroupPrivacy } from '@/logic/utils';
import GroupSummary from '../GroupSummary';

export default function JoinGroupModal() {
  const location = useLocation();
  const navigate = useNavigate();
  const modalNavigate = useModalNavigate();
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
    navigate(`/groups/${flag}`);
  }, [flag, navigate]);

  const reject = useCallback(() => {
    /**
     * Skip the confirmation modal for public groups, since a Join can easily be
     * re-initiated
     */
    if (privacy === 'public') {
      // TODO: consume the backend reject endpoint
      dismiss();
      return;
    }

    modalNavigate(`/gangs/${flag}/reject`, {
      state: { backgroundLocation: location },
    });
  }, [dismiss, flag, location, modalNavigate, privacy]);

  return (
    <Dialog defaultOpen onOpenChange={() => dismiss()}>
      <DialogContent containerClass="w-full max-w-md">
        <div className="space-y-6">
          <h2 className="text-lg font-bold">Join a Group</h2>
          <GroupSummary flag={flag} {...gang.preview} />
          <p>{gang.preview?.meta.description}</p>
          <div className="flex items-center justify-end space-x-2">
            <button
              className="secondary-button mr-auto bg-transparent"
              onClick={() => navigate(-1)}
            >
              Back
            </button>
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
