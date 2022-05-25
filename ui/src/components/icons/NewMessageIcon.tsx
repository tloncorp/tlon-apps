import React from 'react';
import { IconProps } from './icon';

export default function NewMessageIcon({ className }: IconProps) {
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
        d="M19 12a7 7 0 1 0-3.818 6.237l.31-.159.341.069 2.892.578-.578-2.892-.069-.341.159-.31A6.966 6.966 0 0 0 19 12Zm-7-9a9 9 0 0 1 8.174 12.771l.66 3.297a1.5 1.5 0 0 1-1.766 1.765l-3.297-.659A8.97 8.97 0 0 1 12 21a8.99 8.99 0 0 1-2.965-.5A9.022 9.022 0 0 1 3.5 14.965 9 9 0 0 1 12 3Zm1 6a1 1 0 1 0-2 0v2H9a1 1 0 1 0 0 2h2v2a1 1 0 1 0 2 0v-2h2a1 1 0 1 0 0-2h-2V9Z"
        className="fill-current"
      />
    </svg>
  );
}
