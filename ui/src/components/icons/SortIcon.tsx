import React from 'react';
import { IconProps } from './icon';

export default function SortIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M17.207 4.793a1 1 0 0 0-1.414 0l-3 3a1 1 0 0 0 1.414 1.414L15.5 7.914V17.5a1 1 0 1 0 2 0V7.914l1.293 1.293a1 1 0 1 0 1.414-1.414l-3-3ZM8.5 5.5a1 1 0 0 0-2 0v9.586l-1.293-1.293a1 1 0 0 0-1.414 1.414l3 3a1 1 0 0 0 1.414 0l3-3a1 1 0 0 0-1.414-1.414L8.5 15.086V5.5Z"
        className="fill-current"
      />
    </svg>
  );
}
