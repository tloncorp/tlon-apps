import React from 'react';
import { IconProps } from './icon';

export default function ElipsisIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
    >
      <path
        className="fill-current"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M14 19c0-1.1046-.8954-2-2-2s-2 .8954-2 2 .8954 2 2 2 2-.8954 2-2Zm-2-9c1.1046 0 2 .8954 2 2s-.8954 2-2 2-2-.8954-2-2 .8954-2 2-2Zm0-7c1.1046 0 2 .89543 2 2s-.8954 2-2 2-2-.89543-2-2 .8954-2 2-2Z"
      />
    </svg>
  );
}
