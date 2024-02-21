import * as RadixToggle from '@radix-ui/react-toggle';
import classNames from 'classnames';
import React, { useState } from 'react';

export interface ToggleProps extends RadixToggle.ToggleProps {
  toggleClass?: string;
  loading?: boolean;
}

function Toggle({
  defaultPressed,
  pressed,
  onPressedChange,
  disabled,
  className,
  toggleClass,
  loading = false,
}: ToggleProps) {
  const [on, setOn] = useState(defaultPressed);
  const isControlled = !!onPressedChange;
  const proxyPressed = isControlled ? pressed : on;
  const proxyOnPressedChange = isControlled ? onPressedChange : setOn;
  const knobPosition = proxyPressed ? 16 : 8;

  return (
    <RadixToggle.Root
      className={classNames('default-focus rounded-full', className)}
      pressed={proxyPressed}
      onPressedChange={proxyOnPressedChange}
      disabled={disabled || loading}
    >
      <svg
        className={classNames('h-6 w-6', toggleClass)}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
      >
        <rect
          className={classNames(
            'fill-current',
            disabled && proxyPressed && 'text-gray-700',
            !proxyPressed && 'text-gray-200'
          )}
          y="4"
          width="24"
          height="16"
          rx="8"
        />
        <circle
          className={classNames(
            'fill-current text-white',
            disabled && 'opacity-60'
          )}
          cx={knobPosition}
          cy="12"
          r="6"
        />
      </svg>
    </RadixToggle.Root>
  );
}

export default Toggle;
