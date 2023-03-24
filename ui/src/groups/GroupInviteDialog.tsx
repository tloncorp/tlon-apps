import ob from 'urbit-ob';
import React, { useCallback, useState } from 'react';
import cn from 'classnames';
import Dialog, { DialogClose } from '@/components/Dialog';
import ShipSelector, { ShipOption } from '@/components/ShipSelector';
import { useDismissNavigate } from '@/logic/routing';
import { useGroup, useGroupState, useRouteGroup } from '@/state/groups/groups';
import { getPrivacyFromGroup, preSig, useCopy } from '@/logic/utils';
import useRequestState from '@/logic/useRequestState';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import ExclamationPoint from '@/components/icons/ExclamationPoint';
import { useLure } from '@/state/lure/lure';
import TlonIcon from '@/components/icons/TlonIcon';

export default function GroupInviteDialog() {
  const dismiss = useDismissNavigate();
  const flag = useRouteGroup();
  const group = useGroup(flag);
  const privacy = group ? getPrivacyFromGroup(group) : 'public';
  const [ships, setShips] = useState<ShipOption[]>([]);
  const validShips =
    ships && ships.length > 0
      ? ships.every((ship) => ob.isValidPatp(preSig(ship.value)))
      : false;
  const { isPending, setPending, setReady, setFailed, isFailed } =
    useRequestState();
  const { enabled, url } = useLure(flag);
  const { didCopy, doCopy } = useCopy(url);

  const onInvite = useCallback(async () => {
    setPending();
    const shipList = ships.map((s) => preSig(s.value));

    try {
      if (privacy !== 'public') {
        await useGroupState.getState().invite(flag, shipList);
      } else {
        await useGroupState.getState().addMembers(flag, shipList);
      }
      setReady();
      dismiss();
    } catch (e) {
      console.error('Error inviting/adding members: poke failed');
      setFailed();
      setTimeout(() => {
        setReady();
      }, 3000);
    }
  }, [flag, privacy, ships, setPending, setReady, setFailed, dismiss]);

  return (
    <Dialog
      open={true}
      onOpenChange={(isOpen) => !isOpen && dismiss()}
      containerClass="w-full max-w-xl"
      className="bg-transparent p-0"
      close="none"
    >
      <div className="dialog-inner-container flex flex-col">
        {enabled && url ? (
          <div className="card space-y-4 bg-blue-soft">
            <div>
              <h2 className="mb-1 flex text-lg font-bold">
                <span>Send Landscape Invite to Someone</span>
                <TlonIcon className="ml-auto h-6 w-6 p-1" />
              </h2>
              <p className="text-sm font-semibold text-gray-400">
                Courtesy of Tlon Hosting
              </p>
            </div>
            <p className="leading-5">
              Invite someone to this group and gift them an urbit, all with one
              link. Send these to friends, family, and collaborators to get them
              into Urbit easily.
            </p>
            <div className="flex items-center space-x-2">
              <input
                value={url}
                readOnly
                className="flex flex-1 rounded-lg border-2 border-blue-soft bg-blue-soft py-1 px-2 text-lg font-semibold  leading-5 text-blue caret-blue-400 mix-blend-multiply focus:outline-none dark:mix-blend-screen sm:text-base sm:leading-5"
              />
              <button className="button bg-blue" onClick={doCopy}>
                {didCopy ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        ) : null}
        <div className="card">
          <h2 className="mb-4 text-lg font-bold">Invite People To Group</h2>
          <div className="w-full py-3">
            <ShipSelector
              ships={ships}
              setShips={setShips}
              onEnter={onInvite}
            />
          </div>
          <div className="flex items-center justify-end space-x-2">
            <DialogClose className="secondary-button">Cancel</DialogClose>

            <button
              onClick={onInvite}
              className={cn('button text-white dark:text-black', {
                'bg-red': isFailed,
                'bg-blue': !isFailed,
              })}
              disabled={!validShips || isPending || isFailed}
            >
              Invite
              {isPending ? <LoadingSpinner className="ml-2 h-4 w-4" /> : null}
              {isFailed ? <ExclamationPoint className="ml-2 h-4 w-4" /> : null}
            </button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
