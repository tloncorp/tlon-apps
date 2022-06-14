import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import SidebarButton from '../Sidebar/SidebarButton';
import AsteriskIcon from '../icons/AsteriskIcon';
import { GroupMeta } from '../../types/groups';

export default function GroupInfoModal({ meta }: { meta: GroupMeta }) {
  return (
    <Dialog.Root modal>
      <Dialog.Trigger asChild>
        {/* <SidebarButton icon={<AsteriskIcon className="h-3 w-3" />}>
          Group Information
        </SidebarButton> */}
        <button className="dropdown-item flex items-center space-x-2">
          <AsteriskIcon className="h-3 w-3" />
          Group Information
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 h-full w-full bg-neutral-400 opacity-20" />
        <Dialog.Content className="dialog-container">
          <div className="dialog">
            <Dialog.Close>
              <button>close</button>
            </Dialog.Close>
            <Dialog.Title>
              <h2>{meta?.title}</h2>
            </Dialog.Title>
            <Dialog.Description>
              <div>{meta?.description}</div>
            </Dialog.Description>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
