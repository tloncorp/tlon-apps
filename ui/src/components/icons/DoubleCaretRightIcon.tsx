import React from 'react';
import cn from 'classnames';
import { IconProps } from './icon';

export default function DoubleCaretRightIcon({
  className,
  primary,
  secondary,
}: IconProps) {
  return (
    <svg
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
    >
      <path
        d="M7 8L11 12L7 16"
        className={cn('stroke-current', primary)}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15 8L19 12L15 16"
        className={cn('stroke-current', secondary)}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
