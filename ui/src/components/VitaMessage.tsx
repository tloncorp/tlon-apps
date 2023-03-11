import api from '@/api';
import { disableDefault, isTalk, toTitleCase } from '@/logic/utils';
import { useSettingsState, useShowVitaMessage } from '@/state/settings';
import * as Popover from '@radix-ui/react-popover';
import { useCallback } from 'react';

export function disableVita() {
  return api.poke({
    app: isTalk ? 'talk-ui' : 'groups-ui',
    mark: 'ui-vita-toggle',
    json: false,
  });
}

export default function VitaMessage() {
  const show = useShowVitaMessage();
  const close = useCallback(
    (disable: boolean) => () => {
      if (disable) {
        disableVita();
      }

      useSettingsState
        .getState()
        .putEntry(window.desk, 'showVitaMessage', false);
    },
    []
  );

  if (!show) {
    return null;
  }

  return (
    <Popover.Root defaultOpen>
      <Popover.Anchor className="fixed bottom-4 right-4" />
      <Popover.Portal>
        <Popover.Content
          className="w-full max-w-sm space-y-4 rounded-xl bg-white p-6 shadow-lg dark:border dark:border-gray-50"
          side="top"
          align="end"
          onPointerDownOutside={disableDefault}
          onEscapeKeyDown={disableDefault}
          onFocusOutside={disableDefault}
          onInteractOutside={disableDefault}
        >
          <p>
            <strong>{toTitleCase(window.desk)}</strong> now tracks daily usage
            with{' '}
            <a
              href="https://github.com/assemblycapital/vita"
              rel="noreferrer"
              target="_blank"
              className="underline"
            >
              <strong>%vita</strong>
            </a>
            .
          </p>
          <p>
            You can disable it now or in the future using the
            &ldquo;About&rdquo; menu in the top left.
          </p>
          <div className="flex justify-end space-x-2">
            <Popover.Close className="secondary-button" onClick={close(true)}>
              Disable
            </Popover.Close>
            <Popover.Close className="button" onClick={close(false)}>
              Okay
            </Popover.Close>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
