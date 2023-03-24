import React from 'react';
import { IconProps } from './icon';

export default function PencilIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 12 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9.20711 0.292893C8.81658 -0.0976311 8.18342 -0.0976311 7.79289 0.292893L0.292893 7.79289C0.105357 7.98043 0 8.23478 0 8.5V11C0 11.5523 0.447715 12 1 12H3.5C3.76522 12 4.01957 11.8946 4.20711 11.7071L11.7071 4.20711C12.0976 3.81658 12.0976 3.18342 11.7071 2.79289L9.20711 0.292893ZM2 10V8.91421L5.25 5.66421L6.33579 6.75L3.08579 10H2ZM7.75 5.33579L9.58579 3.5L8.5 2.41421L6.66421 4.25L7.75 5.33579Z"
        className="fill-current"
      />
    </svg>
  );
}
