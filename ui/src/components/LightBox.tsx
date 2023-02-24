import Dialog, { DialogContent } from '@/components/Dialog';
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
    <Dialog open={showLightBox} onOpenChange={(open) => setShowLightBox(open)}>
      <DialogContent
        className="flex h-screen w-screen items-center justify-center bg-transparent"
        lightbox
        onClick={() => setShowLightBox(false)}
      >
        {children}
        {source && (
          <a
            href={source}
            className="small-button absolute -top-2 right-6 m-4 cursor-pointer bg-white text-gray-800"
          >
            Source
          </a>
        )}
      </DialogContent>
    </Dialog>
  );
}
