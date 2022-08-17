import React from 'react';
import { IconProps } from './icon';

export default function ElipsisSmallIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="8" cy="3" r="2" className="fill-current" />
      <circle cx="8" cy="8" r="2" className="fill-current" />
      <circle cx="8" cy="13" r="2" className="fill-current" />
    </svg>
  );
}
