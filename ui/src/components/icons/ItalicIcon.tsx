import React from 'react';
import { IconProps } from './icon';

export default function ItalicIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
    >
      <path
        className="fill-current"
        d="m6 18 .46012-2.1166h2.77914l1.58284-7.76684H7.98773L8.42945 6h8.17175l-.4417 2.11656h-2.8159l-1.5645 7.76684h2.8344L14.1718 18H6Z"
      />
    </svg>
  );
}
