import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import AsteriskIcon from '../icons/AsteriskIcon';
import XIcon from '../icons/XIcon';
import { GroupMeta } from '../../types/groups';

export default function GroupInfoModal({ meta }: { meta: GroupMeta }) {
  return (
    <Dialog.Root modal>
      <Dialog.Trigger asChild>
        <button className="dropdown-item flex items-center space-x-4 px-4 font-semibold hover:bg-gray-50 sm:w-60">
          <AsteriskIcon className="h-3 w-3" />
          <div>Group Information</div>
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 h-full w-full bg-neutral-400 opacity-20" />
        <Dialog.Content className="absolute top-8 left-1/2 z-40 h-fit w-full -translate-x-1/2 sm:max-w-lg">
          <div className="w-full overflow-auto rounded-xl bg-white p-6">
            <header className="flex items-center ">
              <Dialog.Title className="text-lg font-bold">
                Group Info
              </Dialog.Title>
              <Dialog.Close asChild>
                <button className="icon-button ml-auto h-6 w-6">
                  <XIcon className="h-5 w-5" />
                </button>
              </Dialog.Close>
            </header>
            <div className="mt-6">
              <Dialog.Description className="flex flex-col items-center">
                {(meta?.image || '').length > 0 ? (
                  <img
                    className="h-20 w-20 rounded-lg border-2 border-transparent"
                    src={meta?.image}
                  />
                ) : (
                  <div className="h-20 w-20 rounded-lg border-2 border-gray-100" />
                )}
                <div className="my-4 text-center">
                  <h2 className="center mb-2 font-semibold">{meta?.title}</h2>
                  {/* Current group meta object doesn't contain public/private info  */}
                  <h3 className="text-base text-gray-600">Private Group</h3>
                </div>
                <p className="w-full leading-5">{meta?.description}</p>
              </Dialog.Description>
            </div>
            <footer className="mt-8 flex items-center">
              <Dialog.Close asChild>
                <button className="button ml-auto">Close</button>
              </Dialog.Close>
            </footer>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
