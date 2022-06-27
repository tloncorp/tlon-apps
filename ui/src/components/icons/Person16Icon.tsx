import React from 'react';
import { IconProps } from './icon';

export default function Person16Icon({ className }: IconProps) {
  return (
    <svg
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
    >
      <path
        className="fill-current"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8 8.46154c1.65685 0 3-.8517 3-3.23077S9.65685 2 8 2s-3 .8517-3 3.23077 1.34315 3.23077 3 3.23077Zm0 0c3.3137 0 6 1.46005 6 5.53846H2c0-4.07841 2.68629-5.53846 6-5.53846Z"
      />
    </svg>
  );
}
