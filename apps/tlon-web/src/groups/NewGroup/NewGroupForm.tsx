import GroupInfoFields from '@/groups/GroupAdmin/GroupInfoFields';
import { useDismissNavigate } from '@/logic/routing';
import { useIsMobile } from '@/logic/useMedia';
import React from 'react';

interface NewGroupFormProps {
  isValid: boolean;
  // TODO: re-activate the back button when templates are added back in
  // goToPrevStep: () => void;
  goToNextStep: () => void;
}

export default function NewGroupForm({
  isValid,
  // goToPrevStep,
  goToNextStep,
}: NewGroupFormProps) {
  const isMobile = useIsMobile();

  const cancel = useDismissNavigate();
  return (
    <div className="flex flex-col space-y-4">
      <div className="flex flex-col">
        <span className="text-lg font-bold">New Group: Group Info</span>
        <span className="pt-1 text-gray-600">
          Provide basic details to distinguish your group
        </span>
      </div>
      <GroupInfoFields />
      <div className="flex justify-end space-x-2 pt-4">
        {isMobile ? null : (
          <button className="secondary-button" onClick={cancel}>
            Cancel
          </button>
        )}
        <button disabled={!isValid} className="button" onClick={goToNextStep}>
          Next: Privacy
        </button>
      </div>
    </div>
  );
}
