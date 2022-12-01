import React from 'react';
import { IconProps } from './icon';

export default function CodeBlockIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4 7L9.07813 11.2318C9.55789 11.6316 9.55789 12.3684 9.07813 12.7682L4 17"
        className="stroke-current"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 19H17C18.1046 19 19 18.1046 19 17V7C19 5.89543 18.1046 5 17 5H10"
        className="stroke-current"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
