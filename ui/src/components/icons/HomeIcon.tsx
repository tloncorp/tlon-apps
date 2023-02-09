import React from 'react';
import { IconProps } from './icon';

export default function HomeIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8 5a1 1 0 0 1 1 1v1.198l1.72-1.433a2 2 0 0 1 2.56 0l5.36 4.467a1 1 0 1 1-1.28 1.536L12 7.302l-5.36 4.466a1 1 0 1 1-1.28-1.536L7 8.865V6a1 1 0 0 1 1-1ZM7 18.5v-5.02a1 1 0 0 1 .375-.78l4.313-3.45a.5.5 0 0 1 .624 0l4.313 3.45a1 1 0 0 1 .375.78v5.02a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5Zm4-2.5a1 1 0 1 1 2 0v3h-2v-3Z"
        fill="none"
        className="fill-current"
      />
    </svg>
  );
}
