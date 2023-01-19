import React, { useEffect } from 'react';
import { useNavigate } from 'react-router';
import Dialog, { DialogContent } from '@/components/Dialog';
import { useGang, useRouteGroup } from '@/state/groups';
import GroupSummary from '@/groups/GroupSummary';
import useGroupJoin from '@/groups/useGroupJoin';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import { matchesBans, pluralRank, toTitleCase } from '@/logic/utils';

export default function JoinGroupModal() {
  const navigate = useNavigate();
  const flag = useRouteGroup();
  const gang = useGang(flag);
  const { group, dismiss, reject, button, status } = useGroupJoin(flag, gang);
  const cordon = gang.preview?.cordon || group?.cordon;
  const banned = cordon ? matchesBans(cordon, window.our) : null;

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
          <GroupSummary flag={flag} preview={gang.preview} />
          <p>{gang.preview?.meta.description}</p>
          <div className="flex items-center justify-end space-x-2">
            <button
              className="secondary-button mr-auto bg-transparent"
              onClick={() => navigate(-1)}
            >
              Back
            </button>
            {banned ? (
              <span className="inline-block px-2 font-semibold text-gray-600">
                {banned === 'ship'
                  ? "You've been banned from this group"
                  : `${toTitleCase(pluralRank(banned))} are banned`}
              </span>
            ) : (
              <>
                {gang.invite && status !== 'loading' ? (
                  <button
                    className="button bg-red text-white dark:text-black"
                    onClick={reject}
                  >
                    Reject Invite
                  </button>
                ) : null}
                {status === 'loading' ? (
                  <div className="flex items-center space-x-2">
                    <span className="text-gray-400">Joining...</span>
                    <LoadingSpinner className="h-5 w-4" />
                  </div>
                ) : status === 'error' ? (
                  <span className="text-red-500">Error</span>
                ) : (
                  <button
                    className="button ml-2 bg-blue text-white dark:text-black"
                    onClick={button.action}
                    disabled={button.disabled}
                  >
                    {button.text}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
