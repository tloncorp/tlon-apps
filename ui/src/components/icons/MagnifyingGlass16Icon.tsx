import React from 'react';
import { IconProps } from './icon';

export default function MagnifyingGlass16Icon({ className }: IconProps) {
  return (
    <svg
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
    >
      <path
        className="fill-current"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M6.00003 7c0-1.65685 1.34314-3 3-3C10.6569 4 12 5.34315 12 7s-1.3431 3-2.99997 3c-1.65686 0-3-1.34315-3-3Zm3-5c-2.76142 0-5 2.23858-5 5 0 1.01907.30487 1.96694.82838 2.75737l-.53552.53553-2 2c-.39052.3905-.39052 1.0237 0 1.4142.39053.3905 1.02369.3905 1.41422 0l2-2 .53551-.5355c.79044.5235 1.73832.8284 2.75741.8284C11.7615 12 14 9.76142 14 7s-2.2385-5-4.99997-5Z"
      />
    </svg>
  );
}
