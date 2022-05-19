import React from 'react';
import { IconProps } from './icon';

export default function PersonIcon({ className }: IconProps) {
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
        d="M12 12.4615C13.6569 12.4615 15 11.6098 15 9.23077C15 6.8517 13.6569 6 12 6C10.3431 6 9 6.8517 9 9.23077C9 11.6098 10.3431 12.4615 12 12.4615ZM12 12.4615C15.3137 12.4615 18 13.9216 18 18H6C6 13.9216 8.68629 12.4615 12 12.4615Z"
        className="fill-current"
      />
    </svg>
  );
}
