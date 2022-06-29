import React from 'react';
import classNames from 'classnames';
import { IconProps } from './icon';

interface ColorBoxIconProps extends IconProps {
  color: string;
  letter: string;
}

export default function ColorBoxIcon({
  className,
  color,
  letter,
}: ColorBoxIconProps) {
  return (
    <div
      className={classNames(
        className,
        'flex items-center justify-center rounded-md'
      )}
      style={{ backgroundColor: color }}
    >
      <span className="text-white">{letter}</span>
    </div>
  );
}
