import React from 'react';
import LeapOption from './LeapOption';

export default function LeapRow({
  option,
  selected,
}: {
  option: LeapOption;
  selected: boolean;
}) {
  const { icon, title, subtitle, onSelect } = option;
  return (
    <div
      onClick={onSelect}
      className={`${
        selected ? 'bg-gray-100' : ''
      } flex cursor-pointer items-center justify-between px-4 py-2 text-base text-gray-700 hover:bg-gray-100`}
    >
      <div className="flex w-full items-center justify-between">
        <div className="flex items-center">
          {/* @ts-expect-error tsc thinks icon is not callable, but it is :) */}
          <div className="mr-2 shrink-0">{icon({ className: 'w-4 h-4' })}</div>
          <div>
            <p className="text-base font-medium text-gray-900">{title}</p>
          </div>
        </div>
        <div className="ml-4 shrink-0 text-sm">{subtitle}</div>
      </div>
    </div>
  );
}
