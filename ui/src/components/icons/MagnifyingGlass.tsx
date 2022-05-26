import React from 'react';
import { IconProps } from './icon';

export default function MagnifyingGlass({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 12 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        className="fill-current"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M4 5a3 3 0 1 1 6 0 3 3 0 0 1-6 0Zm3-5a5 5 0 0 0-4.172 7.757l-.535.536-2 2a1 1 0 1 0 1.414 1.414l2-2 .536-.535A5 5 0 1 0 7 0Z"
      />
    </svg>
  );
}
