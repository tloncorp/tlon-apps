import React from 'react';

import { IconProps } from '../icons/icon';

export interface LeapOption {
  onSelect: () => void;
  icon: (props: IconProps) => JSX.Element;
  input?: string | undefined;
  title: string;
  subtitle: string;
  to: string;
  resultIndex: number;
}

function LeapRowTitle({
  title,
  input,
}: {
  title: string;
  input?: string | undefined;
}) {
  const highlightStyle =
    'whitespace-nowrap text-base font-medium text-gray-400';
  const titleStyle = 'whitespace-nowrap text-base font-semibold text-gray-800';
  if (!input) return <span className={titleStyle}>{title}</span>;
  const index = title.toLowerCase().indexOf(input.toLowerCase());
  if (index === -1) {
    return <span className={titleStyle}>{title}</span>;
  }
  const start = title.slice(0, index);
  const middle = title.slice(index, index + input.length);
  const end = title.slice(index + input.length);
  return (
    <span className={titleStyle}>
      {start}
      <span className={highlightStyle}>{middle}</span>
      {end}
    </span>
  );
}

export default function LeapRow({
  option,
  selected,
}: {
  option: LeapOption;
  selected: boolean;
}) {
  const { icon, title, subtitle, input, onSelect } = option;
  return (
    <div
      onClick={onSelect}
      className={`${
        selected ? 'bg-gray-100' : ''
      } flex cursor-pointer items-center justify-between whitespace-nowrap p-3 text-base text-gray-700 hover:bg-gray-100`}
    >
      <div className="flex w-full items-center">
        <div className="mr-2 shrink-0">{icon({ className: 'w-6 h-6' })}</div>
        <LeapRowTitle title={title} input={input} />
        <span className="shrink-1 ml-2 truncate text-base font-semibold text-gray-400">
          {subtitle}
        </span>
      </div>
    </div>
  );
}
