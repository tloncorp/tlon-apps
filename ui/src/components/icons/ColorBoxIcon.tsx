import React from 'react';
import classNames from 'classnames';
import { IconProps } from '@/components/icons/icon';
import { foregroundFromBackground } from '@/components/Avatar';

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
      className={classNames(className, 'rounded flex items-center justify-center')}
      style={{ backgroundColor: color }}
    >
      <span style={{ color: foregroundFromBackground(color) }}>{letter}</span>
    </div>
  );
}
