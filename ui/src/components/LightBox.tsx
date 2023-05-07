import Dialog from '@/components/Dialog';
import React from 'react';

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
  return (
    <Dialog
      open={showLightBox}
      onOpenChange={(open) => setShowLightBox(open)}
      containerClass="h-full w-full"
      className="flex h-full w-full items-center justify-center bg-transparent p-0"
      close="lightbox"
      onClick={() => setShowLightBox(false)}
    >
      {children}
      {source && (
        <a
          href={source}
          className="small-button absolute -top-2 right-6 m-4 cursor-pointer bg-white text-gray-800"
          target="_blank"
          rel="noreferrer"
        >
          Source
        </a>
      )}
    </Dialog>
  );
}
