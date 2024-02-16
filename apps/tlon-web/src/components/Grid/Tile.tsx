import { getAppHref } from '@/logic/utils';
import { ChargeWithDesk } from '@/state/docket';
import { usePike } from '@/state/kiln';
import { chadIsRunning } from '@urbit/api';
import classNames from 'classnames';
import React from 'react';
import { useDrag } from 'react-dnd';
import { Link, useLocation } from 'react-router-dom';

import BulletIcon from '../icons/BulletIcon';
import Spinner from './Spinner';
import TileMenu from './TileMenu';
// eslint-disable-next-line import/no-cycle
import { dragTypes, useRecentsStore } from './grid';
import useTileColor from './useTileColor';

type TileProps = {
  charge: ChargeWithDesk;
  desk: string;
  disabled?: boolean;
  index: number;
  selectedIndex: number;
};

export default function Tile({
  charge,
  desk,
  disabled = false,
  index,
  selectedIndex,
}: TileProps) {
  const addRecentApp = useRecentsStore((state) => state.addRecentApp);
  const {
    state: { backgroundLocation },
  } = useLocation();
  const { title, image, color, chad, href } = charge;
  const pike = usePike(desk);
  const { lightText, tileColor, menuColor, suspendColor, suspendMenuColor } =
    useTileColor(color);
  const loading = !disabled && 'install' in chad;
  const suspended = disabled || 'suspend' in chad;
  const hung = 'hung' in chad;
  // TODO should held zest be considered inactive? suspended? also, null sync?
  const active = !disabled && chadIsRunning(chad);
  const link = `/app/${desk}`;
  const selected = index === selectedIndex;
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
    <div
      // ref={drop}
      className={classNames(
        'aspect-h-1 aspect-w-1 relative rounded-3xl',
        selected && 'ring-2 ring-blue-500'
        // !isOver && 'ring-transparent'
      )}
      tabIndex={selected ? 0 : -1}
    >
      <Link
        // ref={drag}
        to={active ? link : ''}
        tabIndex={selected ? 0 : -1}
        state={{ backgroundLocation }}
        className={classNames(
          'group absolute h-full w-full overflow-hidden rounded-3xl font-semibold',
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
          <div className="absolute left-4 top-4 z-10 flex items-center sm:left-6 sm:top-6">
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
          {title && (
            <div
              className="h4 absolute bottom-[8%] left-[5%] z-10 rounded-lg px-3 py-1 sm:bottom-7 sm:left-5"
              style={{ backgroundColor }}
            >
              <h3 className="mix-blend-hard-light">{title}</h3>
            </div>
          )}
          {image && !loading && (
            <img
              className="absolute left-0 top-0 h-full w-full object-cover"
              src={image}
              alt=""
            />
          )}
        </div>
      </Link>
    </div>
  );
}
