import React from 'react';
import cn from 'classnames';
import GlobeIcon from '@/components/icons/GlobeIcon';
import LockIcon from '@/components/icons/LockIcon';

type PrivacyTypes = 'public' | 'private' | 'secret';

interface NewGroupPrivacyProps {
  groupName: string;
  goToPrevStep: () => void;
  goToNextStep: () => void;
  setSelectedPrivacy: (privType: PrivacyTypes) => void;
  selectedPrivacy?: PrivacyTypes;
}

interface PrivacySetting {
  title: string;
  icon: React.ReactElement;
  description: string;
  selected?: boolean;
  onClick?: () => void;
}

const PRIVACY_TYPE: Record<PrivacyTypes, PrivacySetting> = {
  public: {
    icon: <GlobeIcon className="h-4 w-4 text-gray-600" />,
    title: 'Public',
    description: 'Anyone can find and join',
  },
  private: {
    icon: <LockIcon className="h-4 w-4 text-gray-600" />,
    title: 'Private',
    description: 'Anyone can find, approval needed to join',
  },
  secret: {
    icon: <GlobeIcon className="h-4 w-4 text-gray-600" />,
    title: 'Secret',
    description: 'Anyone can find, approval needed to join',
  },
};

function PrivacySettingRow({
  title,
  icon,
  description,
  selected = false,
  onClick,
}: React.ButtonHTMLAttributes<HTMLButtonElement> & PrivacySetting) {
  return (
    <div
      className={cn(
        'flex cursor-pointer items-center justify-between rounded-lg border-2 p-2',
        selected ? 'border-gray-200 bg-gray-50' : 'border-gray-100 bg-white'
      )}
      onClick={onClick}
    >
      <div className="flex flex-col">
        <div className="flex flex-row items-center space-x-2">
          <div className="rounded bg-gray-100 p-2">{icon}</div>
          <div className="flex flex-col justify-start">
            <span className="font-semibold">{title}</span>
            <span className="text-sm font-medium text-gray-600">
              {description}
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center">
        {selected ? (
          <div className="h-4 w-4 rounded-xl border-4 border-gray-400" />
        ) : (
          <div className="h-4 w-4 rounded-xl border-2 border-gray-200" />
        )}
      </div>
    </div>
  );
}

export default function NewGroupPrivacy({
  groupName,
  goToNextStep,
  goToPrevStep,
  setSelectedPrivacy,
  selectedPrivacy,
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
            icon={PRIVACY_TYPE[privType as PrivacyTypes].icon}
            title={PRIVACY_TYPE[privType as PrivacyTypes].title}
            description={PRIVACY_TYPE[privType as PrivacyTypes].description}
            selected={privType === selectedPrivacy}
            onClick={() => setSelectedPrivacy(privType as PrivacyTypes)}
          />
        ))}
      </div>
      <div className="flex justify-end space-x-2 py-4">
        <button className="secondary-button" onClick={goToPrevStep}>
          Back
        </button>
        <button
          disabled={selectedPrivacy === undefined}
          className="button"
          onClick={goToNextStep}
        >
          Next
        </button>
      </div>
    </div>
  );
}
