import * as Toast from '@radix-ui/react-toast';
import { useState } from 'react';

import TlonIcon from './icons/TlonIcon';

export default function MobileAppToast() {
  const [open, setOpen] = useState(true);

  return (
    <Toast.Provider>
      <div className="relative flex flex-col items-center">
        <Toast.Root
          duration={10000}
          open={open}
          onOpenChange={setOpen}
        >
          <Toast.Description asChild>
            <div className="absolute w-full z-10 flex -translate-x-2/4 items-center justify-between space-x-2 bg-white font-semibold text-black shadow-xl dark:bg-gray-200 p-4">
              <div className="flex items-center space-x-2">
                <TlonIcon className="w-6 h-6" />
                <span className="px-4 py-2">
                  The all-new Tlon Messenger mobile app is now available.
                </span>
              </div>
              <div className="flex space-x-2">
                <a
                  href="https://apps.apple.com/us/app/tlon-tlon-messenger/id6451392109"
                  target="_blank"
                  rel="noreferrer"
                  className="button"
                >
                  App Store
                </a>
                <a
                  href="https://play.google.com/store/apps/details?id=io.tlon.groups"
                  target="_blank"
                  rel="noreferrer"
                  className="button"
                >
                  Google Play
                </a>
                <button
                  className="secondary-button"
                  onClick={() => {
                    setOpen(false);
                  }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          </Toast.Description>
        </Toast.Root>
        <Toast.Viewport label="new app notice" />
      </div>
    </Toast.Provider>
  );
}
