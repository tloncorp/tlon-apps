import React from 'react';
import { IconProps } from './icon';

export default function Bullet16Icon({ className }: IconProps) {
  return (
    <svg
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
    >
      <circle cx="8" cy="8" r="4" className="fill-current" />
    </svg>
  );
}
