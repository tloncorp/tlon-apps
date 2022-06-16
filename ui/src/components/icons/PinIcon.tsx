import React from 'react';
import { IconProps } from './icon';

export default function PinIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M14 6a4 4 0 0 1-5.822 3.562L3.537 13.54a.764.764 0 0 1-1.077-1.077l3.978-4.64A4 4 0 1 1 14 6Zm-3 2a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
        className="fill-current"
      />
    </svg>
  );
}
