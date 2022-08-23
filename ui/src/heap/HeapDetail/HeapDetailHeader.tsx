import cn from 'classnames';
import React, { Suspense, useCallback, useState } from 'react';
import { useCopyToClipboard } from 'usehooks-ts';
import CaretLeftIcon from '@/components/icons/CaretLeftIcon';
import useNavStore from '@/components/Nav/useNavStore';
import { useIsMobile } from '@/logic/useMedia';
import { Link } from 'react-router-dom';
import CopyIcon from '@/components/icons/CopyIcon';
import ChannelIcon from '@/channels/ChannelIcon';
import { useCurio } from '@/state/heap/heap';
import XIcon from '@/components/icons/XIcon';
import CheckIcon from '@/components/icons/CheckIcon';
import HeapDetailHeaderDescription from './HeapDetailHeaderDescription';

export interface ChannelHeaderProps {
  flag: string;
  chFlag: string;
  idCurio: string;
}

export default function HeapDetailHeader({
  flag,
  chFlag,
  idCurio,
}: ChannelHeaderProps) {
  const [_copied, doCopy] = useCopyToClipboard();
  const [justCopied, setJustCopied] = useState(false);
  const curioObject = useCurio(chFlag, idCurio);
  const isMobile = useIsMobile();
  const curio = curioObject ? curioObject[1] : null;
  const curioContent = curio?.heart.content[0].toString() || '';
  const navPrimary = useNavStore((state) => state.navigatePrimary);
  const curioTitle = curio?.heart.title || curio?.heart.content[0];

  const onCopy = useCallback(() => {
    doCopy(`${flag}/channels/heap/${chFlag}/curio/${idCurio}`);
    setJustCopied(true);
    setTimeout(() => {
      setJustCopied(false);
    }, 1000);
  }, [doCopy, idCurio, chFlag, flag]);

  return (
    <div
      className={cn(
        'flex h-full items-center justify-between border-b-2 border-gray-50 bg-white p-2'
      )}
    >
      <button
        className={cn(
          'cursor-pointer select-none p-2 sm:cursor-text sm:select-text',
          isMobile && '-ml-2 flex items-center rounded-lg hover:bg-gray-50'
        )}
        aria-label="Open Channels Menu"
        onClick={() => isMobile && navPrimary('group', flag)}
      >
        {isMobile ? (
          <CaretLeftIcon className="mr-1 h-5 w-5 text-gray-500" />
        ) : null}
        <div className="flex items-center space-x-3">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-gray-50">
            <ChannelIcon
              nest={`heap/${chFlag}`}
              className="h-4 w-4 text-gray-400"
            />
          </div>
          <div className="flex flex-col items-start text-left lg:max-w-prose">
            <span className="text-md w-52 truncate font-semibold lg:w-auto">
              {curioTitle}
            </span>
            <Suspense
              fallback={
                <div className="text-md font-semibold text-gray-600">
                  Loading...
                </div>
              }
            >
              <HeapDetailHeaderDescription url={curioContent} />
            </Suspense>
          </div>
        </div>
      </button>
      <div>
        <button
          className="icon-button h-8 w-8 bg-transparent"
          aria-controls="copy"
          onClick={onCopy}
        >
          {justCopied ? (
            <CheckIcon className="h-6 w-6" />
          ) : (
            <CopyIcon className="h-6 w-6" />
          )}
        </button>
        <Link
          className="icon-button h-8 w-8 bg-transparent"
          to={`/groups/${flag}/channels/heap/${chFlag}`}
        >
          <XIcon className="h-6 w-6" />
        </Link>
      </div>
    </div>
  );
}
