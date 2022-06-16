import React from 'react';
import { IconProps } from './icon';

export default function PinIcon16({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        className="fill-current"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M18 10C18 12.2091 16.2092 14 14 14C13.3437 14 12.7244 13.8419 12.1779 13.5618L7.5369 17.5398C7.23395 17.7995 6.78216 17.7821 6.50002 17.5C6.21788 17.2179 6.20053 16.7661 6.4602 16.4631L10.4382 11.8221C10.1581 11.2757 10 10.6563 10 10C10 7.79086 11.7909 6 14 6C16.2092 6 18 7.79086 18 10ZM15 12C15.5523 12 16 11.5523 16 11C16 10.4477 15.5523 10 15 10C14.4477 10 14 10.4477 14 11C14 11.5523 14.4477 12 15 12Z"
      />
    </svg>
  );
}
