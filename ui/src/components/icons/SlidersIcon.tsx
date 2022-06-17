import React from 'react';
import { IconProps } from './icon';

export default function SlidersIcon({ className }: IconProps) {
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
        d="M7 3c.55228 0 1 .44772 1 1v6.126c1.72523.4441 3 2.0102 3 3.874s-1.27477 3.4299-3 3.874V20c0 .5523-.44772 1-1 1s-1-.4477-1-1v-2.126C4.27477 17.4299 3 15.8638 3 14s1.27477-3.4299 3-3.874V4c0-.55228.44772-1 1-1Zm11 4.12602V4c0-.55228-.4477-1-1-1s-1 .44772-1 1v3.12602C14.2748 7.57006 13 9.13616 13 11c0 1.8638 1.2748 3.4299 3 3.874V20c0 .5523.4477 1 1 1s1-.4477 1-1v-5.126c1.7252-.4441 3-2.0102 3-3.874 0-1.86384-1.2748-3.42994-3-3.87398ZM7 16c1.10457 0 2-.8954 2-2s-.89543-2-2-2-2 .8954-2 2 .89543 2 2 2Z"
      />
    </svg>
  );
}
