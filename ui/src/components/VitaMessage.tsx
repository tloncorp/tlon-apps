import api from '@/api';
import { disableDefault, isTalk, toTitleCase } from '@/logic/utils';
import { usePutEntryMutation, useShowVitaMessage } from '@/state/settings';
import * as Popover from '@radix-ui/react-popover';
import { useCallback } from 'react';

export function enableVita() {
  return api.poke({
    app: isTalk ? 'talk-ui' : 'groups-ui',
    mark: 'ui-vita-toggle',
    json: true,
  });
}

export default function VitaMessage() {
  const show = useShowVitaMessage();
  const { mutate } = usePutEntryMutation({
    bucket: window.desk,
    key: 'showVitaMessage',
  });
  const close = useCallback(
    (enable: boolean) => () => {
      mutate({ val: false });

      if (enable) {
        enableVita();
      }
    },
    [mutate]
  );

  if (!show) {
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
            Your ship may now use{' '}
            <a
              href="https://github.com/assemblycapital/vita"
              rel="noreferrer"
              target="_blank"
              className="underline"
            >
              %vita
            </a>{' '}
            to tell Tlon{' '}
            <strong>
              when you open {toTitleCase(window.desk)}, once per day.
            </strong>
          </p>
          <p>
            This information is anonymized and used for product analytics only.
          </p>
          <p>
            This action increments a single counter for all{' '}
            {toTitleCase(window.desk)} users and does not contain information
            about your ship, the groups you are in, or the messages you've sent.
          </p>
          <div className="flex justify-end space-x-2">
            <Popover.Close className="secondary-button" onClick={close(false)}>
              Decline
            </Popover.Close>
            <Popover.Close className="button" onClick={close(true)}>
              Enable and Continue
            </Popover.Close>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
