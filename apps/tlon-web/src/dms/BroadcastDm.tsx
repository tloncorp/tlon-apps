import cn from 'classnames';
import { useRef } from 'react';
import { Outlet, Route, Routes, useParams } from 'react-router';
import { Link } from 'react-router-dom';

import ChatInput from '@/chat/ChatInput/ChatInput';
import Layout from '@/components/Layout/Layout';
import { useDragAndDrop } from '@/logic/DragAndDropContext';
import { useBottomPadding } from '@/logic/position';
import { useIsScrolling } from '@/logic/scroll';
import { pluralize } from '@/logic/utils';
import { Cohort, broadcast, useCohort } from '@/state/broadcasts';
import { SendMessageVariables } from '@/state/chat';

import BroadcastHero from './BroadcastHero';
import BroadcastOptions from './BroadcastOptions';
import BroadcastWindow from './BroadcastWindow';
import MultiDmAvatar from './MultiDmAvatar';

function TitleButton({
  cohort,
  isMobile,
}: {
  cohort: Cohort;
  isMobile: boolean;
}) {
  const count = cohort.targets.length;
  const BackButton = isMobile ? Link : 'div';

  return (
    <BackButton
      to={isMobile ? '/messages' : '/'}
      className={cn(
        'default-focus ellipsis w-max-sm inline-flex h-10 appearance-none items-center justify-center space-x-2 rounded p-2'
      )}
      aria-label="Open Messages Menu"
    >
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-center">
        <MultiDmAvatar title={cohort.title} size="xs" />
      </div>
      <div className="flex w-full flex-col justify-center">
        <span
          className={cn(
            'ellipsis line-clamp-1 text-sm font-bold sm:font-semibold'
          )}
        >
          {cohort.title}
        </span>
        <span className="line-clamp-1 w-full break-all text-sm text-gray-400">
          <span>{`${count} ${pluralize('Target', count)}`}</span>
        </span>
      </div>
    </BackButton>
  );
}

export default function BroadcastDm() {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const key = useParams<{ cohort: string }>().cohort!;
  const dropZoneId = `chat-dm-input-dropzone-${key}`;
  const { isDragging, isOver } = useDragAndDrop(dropZoneId);
  const cohort = useCohort(key);
  const root = `/broadcasts/${key}`;
  const scrollElementRef = useRef<HTMLDivElement>(null);
  const isScrolling = useIsScrolling(scrollElementRef);
  const { paddingBottom } = useBottomPadding();

  const sendMessage = (diff: SendMessageVariables) => {
    if (!('add' in diff.delta)) throw new Error('expected WritDeltaAdd');
    broadcast(key, diff.delta.add.memo.content);
  };

  return (
    <>
      <Layout
        style={{
          paddingBottom,
        }}
        className="padding-bottom-transition flex-1"
        header={
          <Routes>
            <Route
              path="*"
              element={
                <div className="flex items-center justify-between border-b-2 border-gray-50 bg-white py-2 pl-2 pr-4">
                  <TitleButton cohort={cohort} isMobile={false} />
                  <div className="flex shrink-0 flex-row items-center space-x-3">
                    {
                      <BroadcastOptions
                        whom={key}
                        pending={false}
                        isMulti
                        alwaysShowEllipsis
                      />
                    }
                  </div>
                </div>
              }
            />
          </Routes>
        }
        footer={
          <div
            className={cn(
              isDragging || isOver ? '' : 'border-t-2 border-gray-50 p-4'
            )}
          >
            <ChatInput
              key={key}
              whom={key}
              sendDm={sendMessage}
              showReply
              autoFocus={true}
              dropZoneId={dropZoneId}
              isScrolling={isScrolling}
            />
          </div>
        }
      >
        <BroadcastWindow
          whom={key}
          root={root}
          prefixedElement={
            <div className="pb-12 pt-4">
              <BroadcastHero cohort={cohort} />
            </div>
          }
        />
      </Layout>
      <Outlet />
    </>
  );
}
