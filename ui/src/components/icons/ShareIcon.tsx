import React from 'react';
import { IconProps } from './icon';

export default function ShareIcon({ className }: IconProps) {
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
        d="M13 7.41421V14c0 .5523-.4477 1-1 1s-1-.4477-1-1V7.41421l-2.29289 2.2929c-.39053.39049-1.02369.39049-1.41422 0-.39052-.39053-.39052-1.02369 0-1.41422l4.00001-4c.3905-.39052 1.0237-.39052 1.4142 0l4 4c.3905.39053.3905 1.02369 0 1.41422-.3905.39049-1.0237.39049-1.4142 0L13 7.41421ZM6 14c0-.5523-.44772-1-1-1s-1 .4477-1 1v3c0 1.6569 1.34315 3 3 3h10c1.6569 0 3-1.3431 3-3v-3c0-.5523-.4477-1-1-1s-1 .4477-1 1v3c0 .5523-.4477 1-1 1H7c-.55228 0-1-.4477-1-1v-3Z"
      />
    </svg>
  );
}
