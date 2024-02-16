import React from 'react';

import { IconProps } from './icon';

export default function ShapesIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
    >
      <rect
        x="2.9"
        y="2.9"
        width="11.2"
        height="11.2"
        rx="2.1"
        className="stroke-current"
        strokeWidth="1.8"
      />
      <circle
        cx="14.5"
        cy="14.5"
        r="6.6"
        className="stroke-current"
        strokeWidth="1.8"
      />
    </svg>
  );
}
