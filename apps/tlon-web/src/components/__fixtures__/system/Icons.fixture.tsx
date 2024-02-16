import { Component, useEffect, useState } from 'react';
import { useValue } from 'react-cosmos/client';

import icons, { smallIcons } from '@/components/icons';

export default function IconButtonFixture() {
  const [{ showTooltip, tooltipText }] = useValue('Tooltip', {
    defaultValue: { showTooltip: true, tooltipText: 'Tooltip' },
  });
  const [isSmall] = useValue('Small', { defaultValue: false });

  return (
    <div className={'wrap flex flex-wrap gap-2'}>
      {Object.entries(icons).map(([name, Icon]) => (
        <div className="flex h-[75px] w-[75px] flex-col items-center justify-center rounded border border-gray-50 bg-white">
          <label className="mb-1 block text-xs text-gray-400">
            {name.replace('Icon', '')}
          </label>
          <div className="mb-2 rounded border border-gray-50">
            <Icon className="h-6 w-6 text-gray-400" />
          </div>
        </div>
      ))}
    </div>
  );
}
