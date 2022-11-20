import React from 'react';
import { IconProps } from './icon';

export default function BranchIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
    >
      <path
        d="M9 3C9 4.10457 8.10457 5 7 5C5.89543 5 5 4.10457 5 3C5 1.89543 5.89543 1 7 1C8.10457 1 9 1.89543 9 3ZM8 8C8 7.44772 7.55228 7 7 7C6.44772 7 6 7.44772 6 8V13V16C6 16.5523 6.44772 17 7 17C7.55228 17 8 16.5523 8 16V14H13C15.7614 14 18 11.7614 18 9V8C18 7.44772 17.5523 7 17 7C16.4477 7 16 7.44772 16 8V9C16 10.6569 14.6569 12 13 12H8V8ZM7 23C8.10457 23 9 22.1046 9 21C9 19.8954 8.10457 19 7 19C5.89543 19 5 19.8954 5 21C5 22.1046 5.89543 23 7 23ZM17 5C18.1046 5 19 4.10457 19 3C19 1.89543 18.1046 1 17 1C15.8954 1 15 1.89543 15 3C15 4.10457 15.8954 5 17 5Z"
        className="fill-current"
      />
    </svg>
  );
}
