import React from 'react';
import { IconProps } from './icon';

export default function CopyIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M5.6 3C4.16406 3 3 4.16406 3 5.6V14.4C3 15.8359 4.16406 17 5.6 17H7V18.4C7 19.8359 8.16406 21 9.6 21H18.4C19.8359 21 21 19.8359 21 18.4V9.6C21 8.16406 19.8359 7 18.4 7H17V5.6C17 4.16406 15.8359 3 14.4 3H5.6ZM15 7V5.6C15 5.26863 14.7314 5 14.4 5H5.6C5.26863 5 5 5.26863 5 5.6V14.4C5 14.7314 5.26863 15 5.6 15H7V9.6C7 8.16406 8.16406 7 9.6 7H15ZM9.6 19C9.26863 19 9 18.7314 9 18.4V16V15V9.6C9 9.26863 9.26863 9 9.6 9H15H16H18.4C18.7314 9 19 9.26863 19 9.6V18.4C19 18.7314 18.7314 19 18.4 19H9.6Z"
        className="fill-current"
      />
    </svg>
  );
}
