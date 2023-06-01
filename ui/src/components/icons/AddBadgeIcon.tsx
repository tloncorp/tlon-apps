import React from 'react';
import { IconProps } from './icon';

export default function BadgeIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M17 5H7C6.44772 5 6 5.44772 6 6H4C4 4.34315 5.34315 3 7 3H17C18.6569 3 20 4.34315 20 6V18C20 19.6569 18.6569 21 17 21H7C5.34315 21 4 19.6569 4 18H6C6 18.5523 6.44772 19 7 19H17C17.0051 19 17.0101 19 17.0152 18.9999H8C8 14.9328 10.6714 13.4695 13.9724 13.4615C12.3283 13.452 11 12.5966 11 10.2308C11 7.8517 12.3431 7 14 7C15.6569 7 17 7.8517 17 10.2308C17 12.5966 15.6717 13.452 14.0275 13.4615C15.85 13.4659 17.1774 13.9154 18 15.0041V6C18 5.44772 17.5523 5 17 5Z"
        className="fill-current"
      />
      <path
        d="M2 12H8M5 9V15"
        className="stroke-current"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
