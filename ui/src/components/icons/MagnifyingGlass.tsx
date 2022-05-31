import React from 'react';
import { IconProps } from './icon';

export default function MagnifyingGlass({ className }: IconProps) {
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
        d="M10 11c0-1.65685 1.3432-3 3-3 1.6569 0 3 1.34315 3 3 0 1.6569-1.3431 3-3 3-1.6568 0-3-1.3431-3-3Zm3-5c-2.7614 0-4.99997 2.23858-4.99997 5 0 1.0191.30487 1.9669.82838 2.7574l-.53552.5355-2 2c-.39052.3905-.39052 1.0237 0 1.4142.39053.3905 1.02369.3905 1.41422 0l2-2 .53549-.5355C11.0331 15.6951 11.9809 16 13 16c2.7615 0 5-2.2386 5-5 0-2.76142-2.2385-5-5-5Z"
      />
    </svg>
  );
}
