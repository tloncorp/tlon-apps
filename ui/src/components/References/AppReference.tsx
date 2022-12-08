import React, { useEffect } from 'react';
import ShipName from '@/components/ShipName';
import ColorBoxIcon from '@/components/icons/ColorBoxIcon';
import useDocketState, { useTreaty } from '@/state/docket';
import { useCalm } from '@/state/settings';
import { getFlagParts } from '@/logic/utils';
import { useIsDark } from '@/logic/useMedia';

interface AppReferenceProps {
  flag: string;
  isScrolling: boolean;
}

export default function AppReference({ flag, isScrolling }: AppReferenceProps) {
  const { ship, name: deskId } = getFlagParts(flag);
  const treaty = useTreaty(ship, deskId);
  const calm = useCalm();
  const dark = useIsDark();
  const href = `/apps/grid/leap/search/${ship}/apps/${ship}/${deskId}`;

  function openLink() {
    window.open(`${window.location.origin}${href}`);
  }

  useEffect(() => {
    if (!treaty && !isScrolling) {
      useDocketState.getState().requestTreaty(ship, deskId);
    }
  }, [treaty, ship, isScrolling, deskId]);

  return (
    <div className="relative flex items-center rounded-lg border-2 border-gray-50 text-base transition-colors hover:border-gray-100 hover:bg-white group-one-hover:border-gray-100 group-one-hover:bg-white">
      {treaty ? (
        <div className="flex w-full flex-row flex-wrap items-center justify-between">
          <div className="flex items-center justify-start rounded-lg p-2 text-left">
            <div className="flex items-center space-x-3 font-semibold">
              {treaty.image && !calm.disableRemoteContent ? (
                <div
                  className="h-12 w-12 rounded-md"
                  style={{ background: treaty.color }}
                >
                  <img src={treaty.image} className="h-12 w-12" />
                </div>
              ) : (
                <ColorBoxIcon
                  color={treaty.color}
                  letter=""
                  className="h-12 w-12"
                />
              )}
              <div className="flex flex-col space-y-1">
                <div className="flex items-center space-x-2">
                  <h3>{treaty.title}</h3>
                  <span className="font-semibold text-gray-400">
                    by <ShipName name={treaty.ship} />
                  </span>
                </div>
                <span className="capitalize text-gray-400">Application</span>
              </div>
            </div>
          </div>
          <div className="p-2">
            <button
              className="small-button ml-2 w-fit bg-blue text-white dark:text-black"
              onClick={openLink}
            >
              Open in Landscape
            </button>
          </div>
        </div>
      ) : (
        <div className="flex w-full items-center justify-start rounded-lg p-2 text-left">
          <div className="flex items-center space-x-3 font-semibold">
            <ColorBoxIcon
              color={dark ? '#333333' : '#E5E5E5'}
              letter={deskId ? deskId.charAt(0) : ''}
              className="h-12 w-12"
            />
            <div className="flex flex-col space-y-1">
              <div className="flex items-center space-x-2">
                <h3>{deskId}</h3>
                <span className="font-semibold text-gray-400">
                  by <ShipName name={ship} />
                </span>
              </div>
              <span className="capitalize text-gray-400">Application</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
