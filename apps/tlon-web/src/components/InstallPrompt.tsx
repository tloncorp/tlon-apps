import api from '@/api';
import { disableDefault } from '@/logic/utils';
import * as Popover from '@radix-ui/react-popover';
import usePWAInstall from 'use-pwa-install';

export function enableVita() {
  return api.poke({
    app: 'groups-ui',
    mark: 'ui-vita-toggle',
    json: true,
  });
}

export default function InstallPrompt() {
  const { isInstalled, install } = usePWAInstall();

  if (isInstalled) {
    return null;
  }

  return (
    <Popover.Root defaultOpen>
      <Popover.Anchor className="fixed bottom-4 right-4" />
      <Popover.Portal>
        <Popover.Content
          className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow-xl dark:border dark:border-gray-50"
          side="top"
          align="end"
          onPointerDownOutside={disableDefault}
          onEscapeKeyDown={disableDefault}
          onFocusOutside={disableDefault}
          onInteractOutside={disableDefault}
        >
          <p>
            You can now install Tlon and use it as a desktop application in one
            click. It will look and feel just like a native app.
          </p>
          <div className="flex justify-end space-x-2">
            <Popover.Close className="secondary-button">Decline</Popover.Close>
            <Popover.Close className="button" onClick={install}>
              Install
            </Popover.Close>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
