import React from 'react';
import { IconProps } from './icon';

export default function LeaveIcon({ className }: IconProps) {
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
        d="M8.41421 11H13c.5523 0 1 .4477 1 1s-.4477 1-1 1H8.41421l1.2929 1.2929c.39049.3905.39049 1.0237 0 1.4142-.39053.3905-1.02369.3905-1.41422 0l-3-3c-.39052-.3905-.39052-1.0237 0-1.4142l3-3.00001c.39053-.39052 1.02369-.39052 1.41422 0 .39049.39053.39049 1.02369 0 1.41422L8.41421 11ZM13 16c-.5523 0-1 .4477-1 1s.4477 1 1 1h3c1.6569 0 3-1.3431 3-3V9c0-1.65685-1.3431-3-3-3h-3c-.5523 0-1 .44771-1 1s.4477 1 1 1h3c.5523 0 1 .44771 1 1v6c0 .5523-.4477 1-1 1h-3Z"
      />
    </svg>
  );
}
