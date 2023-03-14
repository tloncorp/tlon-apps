import { uniq, take, remove } from 'lodash';
import { ChargeWithDesk, useCharges } from '@/state/docket';
import { SettingsState, useSettingsState } from '@/state/settings';
import React, { useEffect } from 'react';
import create from 'zustand';
import produce from 'immer';
import { useEventListener } from 'usehooks-ts';
import { useNavigate } from 'react-router';
import useLeap from '@/components/Leap/useLeap';
import Dialog, { DialogContent } from '../Dialog';
// eslint-disable-next-line import/no-cycle
import Tile from './Tile';
// eslint-disable-next-line import/no-cycle
import TileContainer from './TileContainer';

export const selTiles = (s: SettingsState) => ({
  order: s.tiles.order,
  loaded: s.loaded,
});

export const dragTypes = {
  TILE: 'tile',
};

export interface TileData {
  desk: string;
  charge: ChargeWithDesk;
  position: number;
  dragging: boolean;
}

export interface RecentsStore {
  recentApps: string[];
  recentDevs: string[];
  addRecentApp: (desk: string) => void;
  addRecentDev: (ship: string) => void;
  removeRecentApp: (desk: string) => void;
}

export const useRecentsStore = create<RecentsStore>((set) => ({
  recentApps: [],
  recentDevs: [],
  addRecentApp: (desk: string) => {
    set(
      produce((draft: RecentsStore) => {
        const hasApp = draft.recentApps.find((testDesk) => testDesk === desk);
        if (!hasApp) {
          draft.recentApps.unshift(desk);
        }

        draft.recentApps = take(draft.recentApps, 3);
      })
    );
  },
  addRecentDev: (dev) => {
    set(
      produce((draft: RecentsStore) => {
        const hasDev = draft.recentDevs.includes(dev);
        if (!hasDev) {
          draft.recentDevs.unshift(dev);
        }

        draft.recentDevs = take(draft.recentDevs, 3);
      })
    );
  },
  removeRecentApp: (desk: string) => {
    set(
      produce((draft: RecentsStore) => {
        remove(draft.recentApps, (test) => test === desk);
      })
    );
  },
}));

window.recents = useRecentsStore.getState;

export function addRecentDev(dev: string) {
  return useRecentsStore.getState().addRecentDev(dev);
}

export function addRecentApp(app: string) {
  return useRecentsStore.getState().addRecentApp(app);
}

export default function Grid() {
  const navigate = useNavigate();
  const charges = useCharges();
  const { setIsOpen } = useLeap();
  const chargesLoaded = Object.keys(charges).length > 0;
  const { order, loaded } = useSettingsState(selTiles);

  useEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      setIsOpen(true);
      navigate(-1);
    }
  });

  useEffect(() => {
    const hasKeys = order && !!order.length;
    const chargeKeys = Object.keys(charges);
    const hasChargeKeys = chargeKeys.length > 0;

    if (!loaded) {
      return;
    }

    // Correct order state, fill if none, remove duplicates, and remove
    // old uninstalled app keys
    if (!hasKeys && hasChargeKeys) {
      useSettingsState.getState().putEntry('tiles', 'order', chargeKeys);
    } else if (order.length < chargeKeys.length) {
      useSettingsState
        .getState()
        .putEntry('tiles', 'order', uniq(order.concat(chargeKeys)));
    } else if (order.length > chargeKeys.length && hasChargeKeys) {
      useSettingsState
        .getState()
        .putEntry(
          'tiles',
          'order',
          uniq(order.filter((key) => key in charges).concat(chargeKeys))
        );
    }
  }, [charges, order, loaded]);

  if (!chargesLoaded) {
    return <span>Loading...</span>;
  }

  const onOpenChange = (open: boolean) => {
    if (!open) {
      setIsOpen(true);
      navigate(-1);
    }
  };
  return (
    <Dialog defaultOpen modal onOpenChange={onOpenChange}>
      <DialogContent
        className="overflow-y-auto bg-transparent"
        containerClass="w-full"
      >
        <div className="grid h-fit w-full max-w-6xl grid-cols-2 justify-center gap-4 px-4 sm:grid-cols-[repeat(auto-fit,minmax(auto,200px))] md:px-8">
          {order
            .filter((d) => d !== window.desk && d in charges)
            .filter((d) => d !== 'landscape')
            .filter((d) => d !== 'garden')
            .map((desk, index) => (
              <TileContainer key={desk} desk={desk} tabIndex={index}>
                <Tile charge={charges[desk]} desk={desk} />
              </TileContainer>
            ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
