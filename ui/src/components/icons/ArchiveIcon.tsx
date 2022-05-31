import React from 'react';
import { IconProps } from './icon';

export default function ArchiveIcon({ className }: IconProps) {
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
        d="M4.75 6.25V8h14.5V6.25H4.75Zm-2 2c0 .76847.53229 1.66798 1.5 1.74472V18c0 .4064.1304.827.40577 1.1636.27995.3421.70773.5864 1.20787.5864H18.1364c.5001 0 .9279-.2443 1.2078-.5864.2754-.3366.4058-.7572.4058-1.1636V9.99472c.9677-.07674 1.5-.97625 1.5-1.74472V6c0-.80339-.5818-1.75-1.6346-1.75H4.38461C3.33176 4.25 2.75 5.19661 2.75 6v2.25Zm15 9.5V10H6.25v7.75h11.5Zm-8-6c-.55228 0-1 .4477-1 1s.44772 1 1 1h4.5c.5523 0 1-.4477 1-1s-.4477-1-1-1h-4.5Z"
      />
    </svg>
  );
}
