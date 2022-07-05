import React from 'react';
import { IconProps } from './icon';

export default function ElipsisCircleIcon({ className }: IconProps) {
  // The elipsis here is transparent, waiting on a new icon from @urcades
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
        d="M12 21c-4.97056 0-9-4.0294-9-9 0-4.97056 4.02944-9 9-9 4.9706 0 9 4.02944 9 9 0 4.9706-4.0294 9-9 9Zm-3-9c0 .5523-.44772 1-1 1s-1-.4477-1-1 .44772-1 1-1 1 .4477 1 1Zm3 1c.5523 0 1-.4477 1-1s-.4477-1-1-1-1 .4477-1 1 .4477 1 1 1Zm4 0c.5523 0 1-.4477 1-1s-.4477-1-1-1-1 .4477-1 1 .4477 1 1 1Z"
      />
    </svg>
  );
}
