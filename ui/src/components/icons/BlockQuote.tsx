import React from 'react';
import { IconProps } from './icon';

export default function BlockQuote({ className }: IconProps) {
  return (
    <svg className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        className="fill-current"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M0 1c0-.552284.447715-1 1-1 .55228 0 1 .447715 1 1v12c0 .5523-.44772 1-1 1-.552285 0-1-.4477-1-1V1Zm4 0c0-.552285.44772-1 1-1h6c.5523 0 1 .447715 1 1 0 .55228-.4477 1-1 1H5c-.55228 0-1-.44772-1-1Zm1 3c-.55228 0-1 .44772-1 1s.44772 1 1 1h4c.55228 0 1-.44772 1-1s-.44772-1-1-1H5ZM4 9c0-.55229.44772-1 1-1h8c.5523 0 1 .44771 1 1s-.4477 1-1 1H5c-.55228 0-1-.44771-1-1Zm1 3c-.55228 0-1 .4477-1 1s.44772 1 1 1h3c.55229 0 1-.4477 1-1s-.44771-1-1-1H5Z"
      />
    </svg>
  );
}
