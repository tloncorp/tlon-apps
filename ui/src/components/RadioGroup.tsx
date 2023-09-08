import React from 'react';
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import cn from 'classnames';
import CheckIcon from './icons/CheckIcon';

export type RadioGroupOption = {
  value: string;
  label: string;
  secondaryLabel?: string;
  ariaLabel?: string;
};

export default function RadioGroup({
  value,
  setValue,
  options,
  defaultOption,
}: {
  value: string;
  setValue: (val: string) => void;
  options: RadioGroupOption[];
  defaultOption?: string;
}) {
  return (
    <RadioGroupPrimitive.Root
      className="flex w-full flex-col items-start justify-start font-system-sans text-[17px]"
      value={value}
      defaultValue={defaultOption}
      onValueChange={(val: string) => {
        if (val) {
          setValue(val);
        }
      }}
    >
      {options.map((option, index) => (
        <RadioGroupPrimitive.Item
          key={option.value}
          id={option.value}
          value={option.value}
          aria-label={option.ariaLabel ?? option.label}
          className={cn(
            'flex h-14 w-full cursor-pointer items-center justify-between gap-4 border border-gray-100 py-2 px-6',
            index === 0 ? 'rounded-t-xl' : '',
            index === options.length - 1 ? 'rounded-b-xl' : '',
            index !== 0 && index !== options.length - 1 ? 'border-t-0' : '',
            index === options.length - 1 ? 'border-t-0' : '',
            value === option.value ? 'bg-gray-50' : 'bg-white'
          )}
        >
          <div className="flex flex-col items-start justify-start space-y-1">
            <label htmlFor={option.value}>
              <span className="line-clamp-1">{option.label}</span>
            </label>
            {option.secondaryLabel && (
              <span className="whitespace-break-spaces text-base font-normal text-gray-600 line-clamp-1">
                {option.secondaryLabel}
              </span>
            )}
          </div>
          <RadioGroupPrimitive.Indicator
            className={cn(
              'h-6 w-6 rounded-full',
              value === option.value ? 'bg-blue-500' : 'bg-white'
            )}
          >
            <CheckIcon className="h-6 w-6 text-white" />
          </RadioGroupPrimitive.Indicator>
        </RadioGroupPrimitive.Item>
      ))}
    </RadioGroupPrimitive.Root>
  );
}
