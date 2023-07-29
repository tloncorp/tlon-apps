import React from 'react';
import { IconProps } from './icon';

export default function QuorumIcon(props: IconProps) {
  return (
    <svg
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      {...props}
    >
      <g
        className="fill-none"
        transform="matrix(1.0363903,0,0,1.0363903,-18.904283,-12.304551)"
      >
        <path
          className="stroke-current"
          strokeWidth="30"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M 78.469339,410.62918 78.161725,60.149228 358.73025,270.1911 171.78711,246.98984 Z"
        />
        <path
          className="stroke-current"
          strokeWidth="30"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M 452.34166,107.13833 451.91551,457.61816 171.78734,246.98937 358.6815,270.58196 Z"
        />
      </g>
    </svg>
  );
}
