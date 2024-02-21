import React from 'react';

import { PrivacySelector } from '../GroupAdmin/PrivacySelector';

interface NewGroupPrivacyProps {
  groupName: string;
  goToPrevStep: () => void;
  goToNextStep: () => void;
}

export default function NewGroupPrivacy({
  groupName,
  goToNextStep,
  goToPrevStep,
}: NewGroupPrivacyProps) {
  return (
    <div className="flex flex-col space-y-4">
      <div className="flex flex-col">
        <span className="mb-2 text-lg font-bold">New Group: Group Privacy</span>
        <span className="leading-5 text-gray-600">
          Set <strong>{groupName}</strong>’s default privacy mode.
        </span>
      </div>
      <PrivacySelector horizontal />
      <div className="flex justify-end space-x-2 py-4">
        <button className="secondary-button" onClick={goToPrevStep}>
          Back
        </button>
        <button className="button" onClick={goToNextStep}>
          Next
        </button>
      </div>
    </div>
  );
}
