import React from 'react';
import { IconProps } from './icon';

export default function ExclamationPoint({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 18 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9 18A9 9 0 1 1 9 0a9 9 0 0 1 0 18Zm.002-14a.86.86 0 0 1 .86.88L9.749 9.84a.748.748 0 0 1-1.497 0l-.11-4.962A.86.86 0 0 1 9.002 4ZM10 12.409c-.005.554-.464 1-1 1a.994.994 0 0 1-1-1 .992.992 0 0 1 1-.99c.536 0 .995.444 1 .99Z"
        className="fill-current"
      />
    </svg>
  );
}
