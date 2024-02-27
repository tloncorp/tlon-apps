import { useState } from 'react';

import Dialog from '@/components/Dialog';
import LargeTextInput from '@/components/FullsizeTextInput';
import LargePrimaryButton from '@/components/LargePrimaryButton';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import CaretLeftIcon from '@/components/icons/CaretLeftIcon';
import { useDismissNavigate } from '@/logic/routing';
import useCreateDefaultGroup from '@/logic/useCreateDefaultGroup';
import { strToSym } from '@/logic/utils';

export function CreateGroupSheetView(props: { back: () => void }) {
  return (
    <div className="flex w-full flex-col items-center">
      <div className="mb-4 flex w-full items-center justify-between">
        <div
          className="flex h-6 w-6 items-center justify-center"
          onClick={() => props.back()}
        >
          <CaretLeftIcon className="relative right-1 h-6 w-6" />
        </div>
        <h3 className="text-[17px]">New Group</h3>
        <div className="invisible h-6 w-6" />
      </div>

      <CreateGroupBody />
    </div>
  );
}

export function CreateGroupDialog() {
  const dismiss = useDismissNavigate();
  const onOpenChange = (open: boolean) => {
    if (!open) {
      dismiss();
    }
  };

  return (
    <Dialog
      className="flex h-[400px] w-[500px] flex-col items-start"
      defaultOpen
      modal
      onOpenChange={onOpenChange}
    >
      <div className="mb-4 text-lg font-bold">
        <h3 className="block">New Group</h3>
      </div>
      <CreateGroupBody />
    </Dialog>
  );
}

function CreateGroupBody() {
  const [input, setInput] = useState('');
  const shortCode = strToSym(input).replace(/[^a-z]*([a-z][-\w\d]+)/i, '$1');

  const { createGroup, loading } = useCreateDefaultGroup();

  return (
    <>
      <div className="flex w-full flex-col pt-6">
        <label className="text-small pb-3 text-gray-400">
          Name your group, you can edit it later
        </label>
        <LargeTextInput
          placeholder="Group name"
          data-testid="create-group-name-input"
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <p className="text-small pt-4 text-gray-400">
          Your <span className="text-black">public</span> group will live at:
          <br />
          {window.our}/
          <span className="text-black">
            {input !== '' ? shortCode : 'group-name'}
          </span>
        </p>
        <p className="text-small pt-6 text-gray-400">
          You can edit your group&apos;s privacy later.
        </p>
      </div>

      <div className="mt-6 flex w-full grow items-center justify-center">
        <LargePrimaryButton
          disabled={input === '' || loading}
          onClick={() => createGroup({ title: input, shortCode })}
          data-testid="create-group-submit-button"
        >
          {loading ? (
            <span className="flex w-full items-center justify-center">
              <LoadingSpinner className="h-5 w-5" />
            </span>
          ) : (
            'Create Group'
          )}
        </LargePrimaryButton>
      </div>
    </>
  );
}
