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
      <path
        className="fill-current"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M5 3C3.89543 3 3 3.89543 3 5V13C3 14.1046 3.89543 15 5 15H8.01894C8.27426 18.3562 11.0784 21 14.5 21C18.0899 21 21 18.0899 21 14.5C21 11.0784 18.3562 8.27426 15 8.01894V5C15 3.89543 14.1046 3 13 3H5ZM13 8.17393V5L5 5V13H8.17393C8.73735 10.6148 10.6148 8.73735 13 8.17393ZM19 14.5C19 16.9853 16.9853 19 14.5 19C12.0147 19 10 16.9853 10 14.5C10 12.0147 12.0147 10 14.5 10C16.9853 10 19 12.0147 19 14.5Z"
      />
    </svg>
  );
}
