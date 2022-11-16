import React from 'react';
import { IconProps } from './icon';

export default function LockOpen16Icon({ className }: IconProps) {
  return (
    <svg
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
    >
      <path
        className="fill-current"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M6 5.33333C6 3.94296 6.99193 3 8 3C8.56731 3 9.1054 3.27968 9.48923 3.77895C9.80141 4.18501 10 4.72606 10 5.33333H12C12 4.28888 11.658 3.3185 11.0748 2.55996C10.3582 1.62779 9.25985 1 8 1C5.69436 1 4 3.04181 4 5.33333V7C2.89543 7 2 7.89543 2 9V13C2 14.1046 2.89543 15 4 15H12C13.1046 15 14 14.1046 14 13V9C14 7.89543 13.1046 7 12 7H6V5.33333ZM4 13L4 9H12V13H4Z"
      />
    </svg>
  );
}
