import React from 'react';
import cn from 'classnames';
import { useFormContext } from 'react-hook-form';
import { ChannelPrivacyType } from '@/types/groups';
import { BoardTagMode } from '@/types/quorum';


export interface RadioLabel {
  title: string;
  description: string;
}
export type RadioOption<RadioValue extends string> = Record<RadioValue, RadioLabel>;

export interface RadioProps {
  field: string;
  disabled?: boolean;
  className?: string;
}
interface RadioSelectorProps<RadioValue extends string> extends RadioProps {
  options: RadioOption<RadioValue>;
};
interface RadioRowProps {
  field: string;
  value: string;
  label: RadioLabel;
  disabled?: boolean;
}


export const ChannelPrivacyRadio = (props: RadioProps) => {
  const PRIVACY_OPTIONS: RadioOption<ChannelPrivacyType> = {
    public: {
      title: 'Open to All Members',
      description: 'Everyone can read and write',
    },
    custom: {
      title: 'Custom',
      description: 'Specify which roles can read and write',
    },
  };

  return (
    <RadioSelector options={PRIVACY_OPTIONS} {...props} />
  );
};

export const TagModeRadio = (props: RadioProps) => {
  const TAG_MODE_OPTIONS: RadioOption<BoardTagMode> = {
    unrestricted: {
      title: 'No Restrictions',
      description: 'Users can use any tags they want on their posts',
    },
    restricted: {
      title: 'Restricted to Admin List',
      description: 'Users are restricted to a set of predefined, admin-maintained tags',
    },
  };

  return (
    <RadioSelector options={TAG_MODE_OPTIONS} {...props} />
  );
};

const RadioSelector = <RadioValue extends string>(
  {options, field, disabled, className}: RadioSelectorProps<RadioValue>
) => (
  <ul className={cn("flex flex-col space-y-2", className)}>
    {(Object.entries(options) as [string, RadioLabel][]).map(([value, label]) => (
      <li key={value}>
        <RadioRow field={field} value={value} label={label} disabled={disabled} />
      </li>
    ))}
  </ul>
);

const RadioRow = ({field, value, label, disabled}: RadioRowProps) => {
  const {title, description} = label;
  const {register, watch} = useFormContext();
  const selected: boolean = value === watch(field);

  return (
    <label className={cn(
      "flex items-center justify-between space-x-2 py-2",
      !disabled && "cursor-pointer"
    )}>
      <div className="flex items-center">
        {selected ? (
          <div className="h-4 w-4 rounded-xl border-4 border-gray-400" />
        ) : (
          <div className="h-4 w-4 rounded-xl border-2 border-gray-200" />
        )}
      </div>
      <div className="flex w-full flex-col">
        <div className="flex flex-row items-center space-x-2">
          <div className="flex w-full flex-col justify-start text-left">
            <span className="font-semibold">{title}</span>
            <span className="text-sm font-medium text-gray-600">
              {description}
            </span>
          </div>
        </div>
      </div>
      <input
        {...(!disabled && register(field, {
          required: false,
          // FIXME: Truly shameful; please remove.
          deps: field !== "tagMode" ? [] : ["tags"],
        }))}
        className="sr-only"
        type="radio"
        value={value}
      />
    </label>
  );
};
