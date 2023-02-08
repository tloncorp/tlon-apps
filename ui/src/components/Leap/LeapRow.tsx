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
      } flex cursor-pointer items-center justify-between text-ellipsis whitespace-nowrap p-3 text-base text-gray-700 hover:bg-gray-100`}
    >
      <div className="flex w-full items-center justify-between">
        <div className="flex items-center">
          {/* @ts-expect-error tsc thinks icon is not callable, but it is :) */}
          <div className="mr-2 shrink-0">{icon({ className: 'w-6 h-6' })}</div>
          <p className="">
            <span className="text-base font-medium text-gray-800">{title}</span>
            <span className="shrink-1 ml-2 text-base font-semibold text-gray-400">
              {subtitle}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
