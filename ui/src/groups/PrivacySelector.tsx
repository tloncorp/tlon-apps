import cn from 'classnames';
import React from 'react';
import { useFormContext } from 'react-hook-form';
import GlobeIcon from '@/components/icons/GlobeIcon';
import LockIcon from '@/components/icons/LockIcon';
import PrivateIcon from '@/components/icons/PrivateIcon';
import { GroupFormSchema, PrivacyType } from '@/types/groups';

interface PrivacySetting {
  title: string;
  icon: React.ReactElement;
  description: string;
}

const PRIVACY_TYPE: Record<PrivacyType, PrivacySetting> = {
  public: {
    icon: <GlobeIcon className="h-6 w-6 text-gray-600" />,
    title: 'Public',
    description: 'Anyone can find and join',
  },
  private: {
    icon: <LockIcon className="h-6 w-6 text-gray-600" />,
    title: 'Private',
    description: 'Anyone can find, approval needed to join',
  },
  secret: {
    icon: <PrivateIcon className="h-6 w-6 text-gray-600" />,
    title: 'Secret',
    description: 'No one can find, only invited can join',
  },
};

interface PrivacySettingRowProps {
  type: PrivacyType;
}

function PrivacySettingRow({ type }: PrivacySettingRowProps) {
  const { title, description, icon } = PRIVACY_TYPE[type];
  const { register, watch } = useFormContext<GroupFormSchema>();
  const selected = type === watch('privacy');

  return (
    <label
      className={cn(
        'flex cursor-pointer items-center justify-between rounded-lg border-2 p-2',
        selected ? 'border-gray-200 bg-gray-50' : 'border-gray-100 bg-white'
      )}
    >
      <div className="flex w-full flex-col">
        <div className="flex flex-row items-center space-x-2">
          <div className="p-2">{icon}</div>
          <div className="flex w-full flex-col justify-start text-left">
            <span className="font-semibold">{title}</span>
            <span className="text-sm font-medium text-gray-600">
              {description}
            </span>
          </div>
        </div>
      </div>
      <input
        {...register('privacy')}
        className="sr-only"
        type="radio"
        value={type}
      />
      <div className="flex items-center">
        {selected ? (
          <div className="h-4 w-4 rounded-xl border-4 border-gray-400" />
        ) : (
          <div className="h-4 w-4 rounded-xl border-2 border-gray-200" />
        )}
      </div>
    </label>
  );
}

export default function PrivacySelector() {
  return (
    <ul className="flex flex-col space-y-2">
      {Object.keys(PRIVACY_TYPE).map((privType) => (
        <li key={privType}>
          <PrivacySettingRow type={privType as PrivacyType} />
        </li>
      ))}
    </ul>
  );
}
