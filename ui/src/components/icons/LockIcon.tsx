import React from 'react';
import { IconProps } from '@/components/icons/icon';

export default function LockIcon({ className }: IconProps) {
  return (
    <svg
      fill="none"
      className={className}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9 7C9 5.34315 10.3431 4 12 4C13.6569 4 15 5.34315 15 7V9H9V7ZM17 9V7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7V9C5.34315 9 4 10.3431 4 12V18C4 19.6569 5.34315 21 7 21H17C18.6569 21 20 19.6569 20 18V12C20 10.3431 18.6569 9 17 9ZM6 12C6 11.4477 6.44772 11 7 11H17C17.5523 11 18 11.4477 18 12V18C18 18.5523 17.5523 19 17 19H7C6.44772 19 6 18.5523 6 18V12Z"
        className="fill-current"
      />
    </svg>
  );
}
