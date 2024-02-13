import { EyreState, useEyreState } from '@/state/eyre';
import * as Popover from '@radix-ui/react-popover';
import React from 'react';

import Eyrie from './Eyrie';

function disableDefault<T extends Event>(e: T): void {
  e.preventDefault();
}

const selMenu = (s: EyreState) => ({ open: s.open, toggle: s.toggle });
export default function EyrieMenu() {
  const { open, toggle } = useEyreState(selMenu);

  return (
    <Popover.Root open={open} onOpenChange={toggle}>
      <Popover.Trigger asChild>
        <button className="button bg-rose-400 font-semibold text-rose-100">
          eyrie
        </button>
      </Popover.Trigger>
      <Popover.Content
        onPointerDownOutside={disableDefault}
        onInteractOutside={disableDefault}
        onFocusOutside={disableDefault}
        sideOffset={12}
        className="mr-4 h-[600px] w-[420px] overflow-y-auto"
      >
        <Eyrie />
      </Popover.Content>
    </Popover.Root>
  );
}
