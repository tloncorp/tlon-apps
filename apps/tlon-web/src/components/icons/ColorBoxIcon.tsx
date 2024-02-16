import classNames from 'classnames';
import React from 'react';

import { foregroundFromBackground } from '@/components/Avatar';
import { IconProps } from '@/components/icons/icon';

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
      <span style={{ color: foregroundFromBackground(color) }}>{letter}</span>
    </div>
  );
}
