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
      <path
        className="stroke-current"
        d="m9.0886 14.9114 5.8232-5.82322m-1.4562 7.27942-2.4263 2.4264C10.257 19.5662 9.20971 20 8.11764 20c-1.09206 0-2.1394-.4338-2.91161-1.206C4.43382 18.0218 4 16.9744 4 15.8824c0-1.0921.43382-2.1394 1.20603-2.9117l2.42634-2.4263m8.73523 2.9112 2.4264-2.4263C19.5662 10.257 20 9.20971 20 8.11764c0-1.09206-.4338-2.1394-1.206-2.91161C18.0218 4.43382 16.9744 4 15.8824 4c-1.0921 0-2.1394.43382-2.9117 1.20603l-2.4263 2.42634"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
