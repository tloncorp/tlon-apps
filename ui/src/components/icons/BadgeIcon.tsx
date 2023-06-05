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
        fillRule="evenodd"
        clipRule="evenodd"
        d="M7 5H17C17.5523 5 18 5.44772 18 6V18C18 18.0872 17.9888 18.1718 17.9679 18.2525C17.6554 14.7416 15.1027 13.4615 12 13.4615C13.6569 13.4615 15 12.6098 15 10.2308C15 7.8517 13.6569 7 12 7C10.3431 7 9 7.8517 9 10.2308C9 12.6098 10.3431 13.4615 12 13.4615C8.89729 13.4615 6.34464 14.7416 6.03214 18.2525C6.01116 18.1718 6 18.0872 6 18V6C6 5.44772 6.44772 5 7 5ZM4 6C4 4.34315 5.34315 3 7 3H17C18.6569 3 20 4.34315 20 6V18C20 19.6569 18.6569 21 17 21H7C5.34315 21 4 19.6569 4 18V6Z"
        className="fill-current"
      />
    </svg>
  );
}
