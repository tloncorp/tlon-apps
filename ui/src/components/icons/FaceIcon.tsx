import React from 'react';
import { IconProps } from './icon';

export default function FaceIcon({ className }: IconProps) {
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
        d="M7 4h10c1.6569 0 3 1.34315 3 3v10c0 1.6569-1.3431 3-3 3H7c-1.65685 0-3-1.3431-3-3V7c0-1.65685 1.34315-3 3-3Zm10-2H7C4.23858 2 2 4.23858 2 7v10c0 2.7614 2.23858 5 5 5h10c2.7614 0 5-2.2386 5-5V7c0-2.76142-2.2386-5-5-5ZM8.5 8C7.67157 8 7 8.67157 7 9.5v1c0 .8284.67157 1.5 1.5 1.5s1.5-.6716 1.5-1.5v-1C10 8.67157 9.32843 8 8.5 8ZM14 9.5c0-.82843.6716-1.5 1.5-1.5s1.5.67157 1.5 1.5v1c0 .8284-.6716 1.5-1.5 1.5s-1.5-.6716-1.5-1.5v-1ZM13 15c0 .5523-.4477 1-1 1s-1-.4477-1-1 .4477-1 1-1 1 .4477 1 1Zm2 0c0 1.6569-1.3431 3-3 3s-3-1.3431-3-3 1.3431-3 3-3 3 1.3431 3 3Z"
      />
    </svg>
  );
}
