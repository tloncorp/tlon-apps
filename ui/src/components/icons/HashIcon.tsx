import React from 'react';
import { IconProps } from './icon';

export default function HashIcon({ className }: IconProps) {
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
        d="M6.124.008a1 1 0 0 1 .868 1.116L6.508 5h3.984l.516-4.124a1 1 0 0 1 1.984.248L12.508 5H15a1 1 0 1 1 0 2h-2.742l-.5 4H15a1 1 0 1 1 0 2h-3.492l-.516 4.124a1 1 0 1 1-1.984-.248L9.492 13H5.508l-.516 4.124a1 1 0 1 1-1.984-.248L3.492 13H1a1 1 0 1 1 0-2h2.742l.5-4H1a1 1 0 1 1 0-2h3.492L5.008.876A1 1 0 0 1 6.124.008ZM9.742 11l.5-4H6.258l-.5 4h3.984Z"
        className="fill-current"
      />
    </svg>
  );
}
