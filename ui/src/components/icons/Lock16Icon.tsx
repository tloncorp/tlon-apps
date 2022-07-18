import React from 'react';
import { IconProps } from './icon';

export default function Lock16Icon({ className }: IconProps) {
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
        d="M6 5.33333C6 3.94296 6.99193 3 8 3s2 .94296 2 2.33333V7H6V5.33333ZM12 7V5.33333C12 3.04181 10.3056 1 8 1 5.69436 1 4 3.04181 4 5.33333V7c-1.10457 0-2 .89543-2 2v4c0 1.1046.89543 2 2 2h8c1.1046 0 2-.8954 2-2V9c0-1.10457-.8954-2-2-2Zm-8 6V9h8v4H4Z"
      />
    </svg>
  );
}
