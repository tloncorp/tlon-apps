import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import cn from 'classnames';
import React from 'react';

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
      className="flex w-full flex-col rounded-xl border border-gray-200 font-sans text-[17px]"
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
            'flex h-14 cursor-pointer items-center justify-between border-b border-gray-200 px-6 py-2 text-left',
            index === 0 ? 'rounded-t-xl' : '',
            index === options.length - 1 ? 'rounded-b-xl border-b-0' : '',
            index !== 0 && index !== options.length - 1 ? 'border-t-0' : '',
            index === options.length - 1 ? 'border-t-0' : '',
            value === option.value ? 'bg-gray-50' : 'bg-white'
          )}
        >
          <div>
            <label
              className="line-clamp-1 leading-tight block"
              htmlFor={option.value}
            >
              {option.label}
            </label>
            {option.secondaryLabel && (
              <p className="mt-[4px] line-clamp-1 text-sm font-normal text-gray-600">
                {option.secondaryLabel}
              </p>
            )}
          </div>
          <RadioGroupPrimitive.Indicator
            className={cn(
              'flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
              value === option.value ? 'bg-blue-500' : 'bg-white'
            )}
          >
            <CheckIcon className="h-4 w-4 text-white" />
          </RadioGroupPrimitive.Indicator>
        </RadioGroupPrimitive.Item>
      ))}
    </RadioGroupPrimitive.Root>
  );
}
