import Dialog from '@/components/Dialog';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import { useDismissNavigate } from '@/logic/routing';
import useGroupPrivacy from '@/logic/useGroupPrivacy';
import { toTitleCase } from '@/logic/utils';
import { useGang, useGroupRejectMutation, useRouteGroup } from '@/state/groups';
import React, { useCallback, useEffect, useRef } from 'react';
import { useLocalStorage } from 'usehooks-ts';

const PRIVATE_COPY =
  "If you reject this invite, you'll need to send a membership request in order to join this group.";
const SECRET_COPY =
  "You won't be able to find, view, or rediscover this group if you reject this invite. You'll explicitly need to be re-invited in order to view it.";

const COPY: Record<string, string> = {
  private: PRIVATE_COPY,
  secret: SECRET_COPY,
};

export default function RejectConfirmModal() {
  const flag = useRouteGroup();
  const gang = useGang(flag);
  const dismiss = useDismissNavigate();
  const { privacy } = useGroupPrivacy(flag);
  const checkboxRef = useRef<HTMLInputElement | null>(null);
  const [skipConfirmation, setSkipConfirmation] = useLocalStorage(
    'groups:skipGroupInviteRejectConfirm',
    false
  );
  const { mutate: rejectMutation, status } = useGroupRejectMutation();

  const cancel = useCallback(async () => {
    dismiss();
  }, [dismiss]);

  const reject = useCallback(async () => {
    if (checkboxRef && checkboxRef.current?.checked) {
      setSkipConfirmation(true);
    }

    try {
      rejectMutation({ flag });
      dismiss();
    } catch (e) {
      console.log('error rejecting invite', e);
    }
  }, [dismiss, flag, setSkipConfirmation, rejectMutation]);

  useEffect(() => {
    if (skipConfirmation) {
      reject();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Dialog
      defaultOpen
      onOpenChange={() => dismiss()}
      containerClass="w-full max-w-md"
    >
      <div className="space-y-6">
        <h2 className="text-lg font-bold">
          Reject {toTitleCase(privacy)} Group Invite?
        </h2>
        <p className="leading-5">
          Are you sure you'd like to reject your invite to &quot;
          {gang.preview?.meta.title}&quot;?
        </p>
        <p className="leading-5">{COPY[privacy]}</p>
        <div>
          <label className="mb-2 block">
            <input
              className="mr-2"
              type="checkbox"
              ref={checkboxRef}
              name="skip-confirm"
            />
            <span className="font-semibold text-gray-800">
              Don&apos;t show this confirmation again
            </span>
          </label>
          <p className="leading-5 text-gray-600">
            The next time you opt to reject an invite, there will be no
            confirmation step
          </p>
        </div>
        <div className="flex items-center justify-end space-x-2">
          <button className="button bg-gray-50 text-gray-800" onClick={cancel}>
            Cancel
          </button>
          <button
            disabled={status === 'loading'}
            className="button ml-2 bg-red-soft text-red"
            onClick={reject}
          >
            {status === 'idle' ? (
              'Reject Invite'
            ) : (
              <>
                'Rejecting...'
                <LoadingSpinner className="h-5 w-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
