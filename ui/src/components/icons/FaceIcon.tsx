import React from 'react';
import { IconProps } from './icon';

export default function FaceIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M5 2h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3Zm10-2H5a5 5 0 0 0-5 5v10a5 5 0 0 0 5 5h10a5 5 0 0 0 5-5V5a5 5 0 0 0-5-5ZM6.5 6A1.5 1.5 0 0 0 5 7.5v1a1.5 1.5 0 1 0 3 0v-1A1.5 1.5 0 0 0 6.5 6ZM12 7.5a1.5 1.5 0 0 1 3 0v1a1.5 1.5 0 0 1-3 0v-1ZM11 13a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm2 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
        className="fill-current"
      />
    </svg>
  );
}
