import classNames from 'classnames';
import React from 'react';
import { useDrag } from 'react-dnd';
import { getAppHref } from '@/logic/utils';
import { chadIsRunning } from '@urbit/api';
import { usePike } from '@/state/kiln';
import { ChargeWithDesk } from '@/state/docket';
import TileMenu from './TileMenu';
import useTileColor from './useTileColor';
// eslint-disable-next-line import/no-cycle
import { dragTypes, useRecentsStore } from './Grid';
import BulletIcon from '../icons/BulletIcon';
import Spinner from './Spinner';

type TileProps = {
  charge: ChargeWithDesk;
  desk: string;
  disabled?: boolean;
};

export default function Tile({ charge, desk, disabled = false }: TileProps) {
  const addRecentApp = useRecentsStore((state) => state.addRecentApp);
  const { title, image, color, chad, href } = charge;
  const pike = usePike(desk);
  const { lightText, tileColor, menuColor, suspendColor, suspendMenuColor } =
    useTileColor(color);
  const loading = !disabled && 'install' in chad;
  const suspended = disabled || 'suspend' in chad;
  const hung = 'hung' in chad;
  // TODO should held zest be considered inactive? suspended? also, null sync?
  const active = !disabled && chadIsRunning(chad);
  const link = getAppHref(href);
  const backgroundColor = suspended
    ? suspendColor
    : active
    ? tileColor || 'purple'
    : suspendColor;

  // const [{ isDragging }, drag] = useDrag(() => ({
  // type: dragTypes.TILE,
  // item: { desk },
  // collect: (monitor) => ({
  // isDragging: !!monitor.isDragging(),
  // }),
  // }));

  return (
    <a
      // ref={drag}
      href={active ? link : undefined}
      target="_blank"
      rel="noreferrer"
      className={classNames(
        'default-ring group absolute h-full w-full overflow-hidden rounded-3xl font-semibold focus-visible:ring-4',
        suspended && 'opacity-50 grayscale',
        // isDragging && 'opacity-0',
        lightText && active && !loading ? 'text-gray-200' : 'text-gray-800',
        !active && 'cursor-default'
      )}
      style={{ backgroundColor }}
      onClick={() => addRecentApp(desk)}
      onAuxClick={() => addRecentApp(desk)}
    >
      <div>
        <div className="absolute top-4 left-4 z-10 flex items-center sm:top-6 sm:left-6">
          {pike?.zest === 'held' && !disabled && (
            <BulletIcon className="h-4 w-4 text-orange-500 dark:text-black" />
          )}
          {!active && (
            <>
              {loading && <Spinner className="mr-2 h-6 w-6" />}
              <span className="text-gray-500">
                {suspended
                  ? 'Suspended'
                  : loading
                  ? 'Installing'
                  : hung
                  ? 'Errored'
                  : null}
              </span>
            </>
          )}
        </div>
        <TileMenu
          desk={desk}
          chad={chad}
          menuColor={active ? menuColor : suspendMenuColor}
          lightText={lightText}
          className="pointer-coarse:opacity-100 hover-none:opacity-100 absolute top-3 right-3 z-10 opacity-0 focus:opacity-100 group-hover:opacity-100 sm:top-5 sm:right-5"
        />
        {title && (
          <div
            className="h4 absolute bottom-[8%] left-[5%] z-10 rounded-lg py-1 px-3 sm:bottom-7 sm:left-5"
            style={{ backgroundColor }}
          >
            <h3 className="mix-blend-hard-light">{title}</h3>
          </div>
        )}
        {image && !loading && (
          <img
            className="absolute top-0 left-0 h-full w-full object-cover"
            src={image}
            alt=""
          />
        )}
      </div>
    </a>
  );
}
