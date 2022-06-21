import React from 'react';
import { IconProps } from './icon';

export default function InviteIcon({ className }: IconProps) {
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
        d="M12 9.23077c0 2.37903-1.3431 3.23073-3 3.23073-1.65685 0-3-.8517-3-3.23073C6 6.8517 7.34315 6 9 6c1.6569 0 3 .8517 3 3.23077ZM9 12.4615c-3.31371 0-6 1.4601-6 5.5385h12c0-4.0784-2.6863-5.5385-6-5.5385ZM19 8c0-.55228-.4477-1-1-1s-1 .44772-1 1v2h-2c-.5523 0-1 .4477-1 1s.4477 1 1 1h2v2c0 .5523.4477 1 1 1s1-.4477 1-1v-2h2c.5523 0 1-.4477 1-1s-.4477-1-1-1h-2V8Z"
      />
    </svg>
  );
}
