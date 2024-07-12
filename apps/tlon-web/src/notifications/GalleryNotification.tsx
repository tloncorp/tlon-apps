import { ActivityBundle, ActivityEvent } from '@tloncorp/shared/dist/urbit';
import { ReactNode } from 'react';

import HeapBlock from '@/heap/HeapBlock';
import { useIsMobile } from '@/logic/useMedia';
import { nestToFlag } from '@/logic/utils';
import { usePost } from '@/state/channel/channel';

import ActivitySummary from './ActivitySummary';

interface GalleryNotificationProps {
  top: ActivityEvent;
  bundle: ActivityBundle;
  avatar?: ReactNode;
  topLine?: ReactNode;
}

export function GalleryNotification({
  top,
  bundle,
  avatar,
  topLine,
}: GalleryNotificationProps) {
  const isMobile = useIsMobile();
  const curioId = 'post' in top ? top.post.key.time : '';
  const heapFlag = 'post' in top ? nestToFlag(top.post.channel)[1] : '';
  const { post: note, isLoading } = usePost(`heap/${heapFlag}`, curioId);
  const link = '';
  if (!note || isLoading) {
    return null;
  }

  return (
    <div className="flex flex-col">
      <div className="relative flex space-x-3 rounded-xl bg-white p-2 text-gray-400">
        <div className="flex w-full min-w-0 flex-1 space-x-3">
          <div className="relative flex-none self-start">{avatar}</div>
          <div className="flex flex-col space-y-2">
            <div className="min-w-0 grow-0 break-words p-1">{topLine}</div>
            <div className="my-2 leading-5">
              <ActivitySummary top={top} bundle={bundle} />
            </div>
            <div className="max-w-[36px] sm:max-w-[190px]">
              <div className="aspect-h-1 aspect-w-1 cursor-pointer">
                <HeapBlock
                  post={note}
                  time={curioId}
                  asMobileNotification={isMobile}
                  linkFromNotification={link}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
