import React from 'react';
import { IconProps } from './icon';

export default function LinkIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
    >
      <rect
        x="3.8284"
        y="16"
        width="10"
        height="6"
        rx="3"
        transform="rotate(-45 3.8284 16)"
        stroke="#666"
        strokeWidth="2"
      />
      <rect
        x="10.8995"
        y="11.0503"
        width="7"
        height="3"
        rx="1.5"
        transform="rotate(-45 10.8995 11.0503)"
        stroke="#fff"
      />
      <rect
        x="6.65681"
        y="11.0503"
        width="13"
        height="9"
        rx="4.5"
        transform="rotate(-45 6.65681 11.0503)"
        stroke="#fff"
      />
      <mask
        id="a"
        maskUnits="userSpaceOnUse"
        x="5"
        y="10"
        width="12"
        height="12"
      >
        <path
          transform="rotate(-45 5.24268 18.8284)"
          fill="#C4C4C4"
          d="M5.24268 18.8284h12v4h-12z"
        />
      </mask>
      <g mask="url(#a)">
        <rect
          x="3.82852"
          y="16"
          width="10"
          height="6"
          rx="3"
          transform="rotate(-45 3.82852 16)"
          stroke="#666"
          strokeWidth="2"
        />
      </g>
      <rect
        x="8.77823"
        y="11.0503"
        width="10"
        height="6"
        rx="3"
        transform="rotate(-45 8.77823 11.0503)"
        stroke="#666"
        strokeWidth="2"
      />
      <mask id="b" maskUnits="userSpaceOnUse" x="6" y="11" width="8" height="8">
        <path
          transform="rotate(-45 6.65686 17.4142)"
          fill="#C4C4C4"
          d="M6.65686 17.4142h8v2h-8z"
        />
      </mask>
      <g mask="url(#b)">
        <rect
          x="5.94978"
          y="16"
          width="7"
          height="3"
          rx="1.5"
          transform="rotate(-45 5.94978 16)"
          stroke="#fff"
        />
      </g>
      <mask
        id="c"
        maskUnits="userSpaceOnUse"
        x="3"
        y="8"
        width="15"
        height="16"
      >
        <path
          transform="rotate(-45 3.12134 18.1213)"
          fill="#C4C4C4"
          d="M3.12134 18.1213h14v7h-14z"
        />
      </mask>
      <g mask="url(#c)">
        <rect
          x="1.70711"
          y="16"
          width="13"
          height="9"
          rx="4.5"
          transform="rotate(-45 1.70711 16)"
          stroke="#fff"
        />
      </g>
    </svg>
  );
}
