import React from 'react';
import { IconProps } from './icon';

export default function AddPersonIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
    >
      <path
        d="M12 9.2308c0 2.379-1.3431 3.2307-3 3.2307s-3-.8517-3-3.2307C6 6.8517 7.3431 6 9 6s3 .8517 3 3.2308Zm-3 3.2307c-3.3137 0-6 1.4601-6 5.5385h12c0-4.0784-2.6863-5.5385-6-5.5385ZM19 8c0-.5523-.4477-1-1-1s-1 .4477-1 1v2h-2c-.5523 0-1 .4477-1 1s.4477 1 1 1h2v2c0 .5523.4477 1 1 1s1-.4477 1-1v-2h2c.5523 0 1-.4477 1-1s-.4477-1-1-1h-2V8Z"
        className="fill-current"
      />
    </svg>
  );
}
