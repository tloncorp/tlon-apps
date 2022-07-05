import React from 'react';

interface NewGroupPrivacyProps {
  groupName: string;
  goToPrevStep: () => void;
  goToNextStep: () => void;
}

interface PrivacySetting {
  title: string;
  icon: string;
  description: string;
}

const PRIVACY_TYPE: Record<string, PrivacySetting> = {
  public: {
    icon: 'world',
    title: 'Public',
    description: 'Anyone can find and join',
  },
  private: {
    icon: 'lock',
    title: 'Private',
    description: 'Anyone can find, approval needed to join',
  },
  Secret: {
    icon: 'x',
    title: 'Secret',
    description: 'Anyone can find, approval needed to join',
  },
};

function PrivacySettingRow({ title, icon, description }: PrivacySetting) {
  return (
    <div className="flex items-center justify-between rounded-lg border-2 border-gray-100 bg-white p-2">
      <div className="flex flex-col">
        <div className="flex flex-row items-center space-x-2">
          <div>{icon}</div>
          <div className="flex flex-col">
            <span className="font-semibold">{title}</span>
            <span className="text-sm font-medium text-gray-600">
              {description}
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center">
        <input type="radio" />
      </div>
    </div>
  );
}

export default function NewGroupPrivacy({
  groupName,
  goToNextStep,
  goToPrevStep,
}: NewGroupPrivacyProps) {
  return (
    <div className="flex flex-col space-y-4">
      <div className="flex flex-col">
        <span className="text-lg font-bold">Group Privacy</span>
        <span className="pt-1 font-bold text-gray-600">
          Set how people can find and join {groupName}
        </span>
      </div>
      <div className="flex flex-col space-y-2">
        {Object.keys(PRIVACY_TYPE).map((privType) => (
          <PrivacySettingRow
            key={privType}
            icon={PRIVACY_TYPE[privType].icon}
            title={PRIVACY_TYPE[privType].title}
            description={PRIVACY_TYPE[privType].description}
          />
        ))}
      </div>
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
