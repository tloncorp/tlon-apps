import React from 'react';
import { IconProps } from './icon';

export default function NotebookIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
    >
      <path
        className="fill-current"
        d="M4 4V3H3v1h1Zm0 15H3v1h1v-1Zm3 3c0 .5523.44772 1 1 1s1-.4477 1-1H7Zm4.5-13.5c-.5523 0-1 .44772-1 1 0 .5523.4477 1 1 1v-2Zm4 2c.5523 0 1-.4477 1-1 0-.55228-.4477-1-1-1v2ZM3 4v15h2V4H3Zm15 2v11h2V6h-2ZM4 5h4V3H4v2Zm4 0h9V3H8v2Zm9 13H8v2h9v-2Zm-9 0H4v2h4v-2ZM7 4v15h2V4H7Zm0 15v3h2v-3H7Zm4.5-8.5h4v-2h-4v2ZM18 17c0 .5523-.4477 1-1 1v2c1.6569 0 3-1.3431 3-3h-2Zm2-11c0-1.65685-1.3431-3-3-3v2c.5523 0 1 .44772 1 1h2Z"
      />
    </svg>
  );
}
