import React from 'react';
import { IconProps } from './icon';

export default function BulletIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
    >
      <rect className="fill-current" x="8" y="8" width="8" height="8" rx="4" />
    </svg>
  );
}
