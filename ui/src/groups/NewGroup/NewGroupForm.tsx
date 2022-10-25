import React from 'react';
import GroupInfoFields from '../GroupInfoFields';

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
        {/* <button className="secondary-button" onClick={goToPrevStep}>
          Back
        </button> */}
        <button disabled={!isValid} className="button" onClick={goToNextStep}>
          Next
        </button>
      </div>
    </div>
  );
}
