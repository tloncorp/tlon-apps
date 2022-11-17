import React, { useEffect } from 'react';
import Dialog, { DialogContent } from '@/components/Dialog';
import { useGang, useRouteGroup } from '@/state/groups';
import { useNavigate } from 'react-router';
import GroupSummary from '@/groups/GroupSummary';
import useGroupJoin from '@/groups/useGroupJoin';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';

export default function JoinGroupModal() {
  const navigate = useNavigate();
  const flag = useRouteGroup();
  const gang = useGang(flag);
  const { group, dismiss, reject, button, status } = useGroupJoin(flag, gang);

  useEffect(() => {
    if (group) {
      navigate(`/groups/${flag}`);
    }
  }, [group, flag, navigate]);

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
            {gang.invite && status !== 'loading' ? (
              <button
                className="button bg-red text-white dark:text-black"
                onClick={reject}
              >
                Reject Invite
              </button>
            ) : null}
            {status === 'loading' ? (
              <LoadingSpinner />
            ) : (
              <button
                className="button ml-2 bg-blue text-white dark:text-black"
                onClick={button.action}
                disabled={button.disabled}
              >
                {button.text}
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
