import React from 'react';
import { IconProps } from './icon';

export default function MicrophoneIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M13 7V11C13 11.5523 12.5523 12 12 12C11.4477 12 11 11.5523 11 11V7C11 6.44772 11.4477 6 12 6C12.5523 6 13 6.44772 13 7ZM9 7C9 5.34315 10.3431 4 12 4C13.6569 4 15 5.34315 15 7V11C15 12.6569 13.6569 14 12 14C10.3431 14 9 12.6569 9 11V7ZM8 11C8 10.4477 7.55228 10 7 10C6.44772 10 6 10.4477 6 11C6 13.9047 8.18856 16.2612 11 16.7193V19C11 19.5523 11.4477 20 12 20C12.5523 20 13 19.5523 13 19V16.7193C15.8114 16.2612 18 13.9047 18 11C18 10.4477 17.5523 10 17 10C16.4477 10 16 10.4477 16 11C16 13.0606 14.248 14.8 12 14.8C9.75199 14.8 8 13.0606 8 11Z"
        className="fill-current"
      />
    </svg>
  );
}
