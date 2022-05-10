import React from 'react';
import { IconProps } from './icon';

export default function BlockquoteIcon({ className }: IconProps) {
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
        d="M5 6c0-.55228.44772-1 1-1s1 .44772 1 1v12c0 .5523-.44772 1-1 1s-1-.4477-1-1V6Zm4 0c0-.55228.44772-1 1-1h6c.5523 0 1 .44772 1 1s-.4477 1-1 1h-6c-.55228 0-1-.44772-1-1Zm1 3c-.55228 0-1 .44772-1 1 0 .5523.44772 1 1 1h4c.5523 0 1-.4477 1-1 0-.55228-.4477-1-1-1h-4Zm-1 5c0-.5523.44772-1 1-1h8c.5523 0 1 .4477 1 1s-.4477 1-1 1h-8c-.55228 0-1-.4477-1-1Zm1 3c-.55228 0-1 .4477-1 1s.44772 1 1 1h3c.5523 0 1-.4477 1-1s-.4477-1-1-1h-3Z"
      />
    </svg>
  );
}
