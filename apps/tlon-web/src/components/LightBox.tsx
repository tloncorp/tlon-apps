import Dialog from '@/components/Dialog';
import { useSafeAreaInsets } from '@/logic/native';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import React from 'react';

import X16Icon from './icons/X16Icon';

export default function LightBox({
  showLightBox,
  setShowLightBox,
  source,
  children,
}: {
  showLightBox: boolean;
  setShowLightBox: (s: boolean) => void;
  source?: string;
  children: React.ReactNode;
}) {
  const safeAreaInsets = useSafeAreaInsets();
  return (
    <Dialog
      open={showLightBox}
      onOpenChange={(open) => setShowLightBox(open)}
      containerClass="h-full w-full"
      className="flex h-full w-full items-center justify-center bg-transparent p-0"
      style={{
        paddingTop: safeAreaInsets.top,
      }}
      close="none"
      onClick={() => setShowLightBox(false)}
    >
      {children}
      {source && (
        <a
          href={source}
          className="default-focus small-button absolute -top-2 right-6 m-4 cursor-pointer bg-white text-gray-800"
          target="_blank"
          rel="noreferrer"
        >
          Source
        </a>
      )}
      <DialogPrimitive.Close className="icon-button absolute right-2 top-2 bg-white">
        <X16Icon className="white h-4 w-4" />
      </DialogPrimitive.Close>
    </Dialog>
  );
}
