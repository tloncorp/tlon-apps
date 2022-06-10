import React from 'react';
import { IconProps } from './icon';

export default function CmdSmallIcon({ className }: IconProps) {
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
        d="M4 5c.55228 0 1-.44772 1-1s-.44772-1-1-1-1 .44772-1 1 .44772 1 1 1Zm3-1v1h2V4c0-1.65685 1.3431-3 3-3s3 1.34315 3 3-1.3431 3-3 3h-1v2h1c1.6569 0 3 1.3431 3 3s-1.3431 3-3 3-3-1.3431-3-3v-1H7v1c0 1.6569-1.34315 3-3 3s-3-1.3431-3-3 1.34315-3 3-3h1V7H4C2.34315 7 1 5.65685 1 4s1.34315-3 3-3 3 1.34315 3 3Zm2 5V7H7v2h2Zm2 3c0 .5523.4477 1 1 1s1-.4477 1-1-.4477-1-1-1-1 .4477-1 1Zm0-8c0 .55228.4477 1 1 1s1-.44772 1-1-.4477-1-1-1-1 .44772-1 1Zm-7 7c.55228 0 1 .4477 1 1s-.44772 1-1 1-1-.4477-1-1 .44772-1 1-1Z"
      />
    </svg>
  );
}
