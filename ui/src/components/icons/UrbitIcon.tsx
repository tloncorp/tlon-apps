import React from 'react';
import { IconProps } from './icon';

export default function UrbitIcon(props: IconProps) {
  return (
    <svg
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      {...props}
    >
      <circle
        // FIXME: The 'fill-white' here should be like 'fill-background'
        // or something similar
        className="fill-white stroke-current"
        cx="16"
        cy="16"
        r="13"
        strokeWidth="2"
      />
      <path
        className="stroke-current"
        d="M22 14.0488H19.6306C19.4522 15.0976 18.9936 15.7317 18.1783 15.7317C16.7006 15.7317 15.8599 14 13.5669 14C11.3503 14 10.1783 15.3659 10 17.9756H12.3694C12.5478 16.9024 13.0064 16.2683 13.8471 16.2683C15.3248 16.2683 16.1146 18 18.4586 18C20.6242 18 21.8217 16.6341 22 14.0488Z"
      />
    </svg>
  );
}
