import { useRef, useState } from 'react';
import cn from 'classnames';
import { debounce } from 'lodash';
import { Link } from 'react-router-dom';
import { usePinnedChats } from '@/state/pins';
import ReconnectingSpinner from '@/components/ReconnectingSpinner';
import MobileHeader from '@/components/MobileHeader';
import AddIconMobileNav from '@/components/icons/AddIconMobileNav';
import MessagesList from './MessagesList';
import MessagesSidebarItem from './MessagesSidebarItem';
import { MessagesScrollingContext } from './MessagesScrollingContext';

export default function MobileMessagesSidebar() {
  const [isScrolling, setIsScrolling] = useState(false);
  const pinned = usePinnedChats(true);

  const scroll = useRef(
    debounce((scrolling: boolean) => setIsScrolling(scrolling), 200)
  );

  return (
    <div className="flex h-full w-full flex-col">
      <MobileHeader
        title="Messages"
        action={
          <div className="flex h-12 items-center justify-end space-x-2">
            <ReconnectingSpinner />
            <Link
              to="/dm/new"
              className="default-focus flex items-center text-base"
              aria-label="New Direct Message"
            >
              <AddIconMobileNav className="h-8 w-8 text-black" />
            </Link>
          </div>
        }
      />
      <nav className={cn('flex h-full w-full flex-col bg-white')}>
        <MessagesScrollingContext.Provider value={isScrolling}>
          <MessagesList filter="Direct Messages" isScrolling={scroll.current}>
            {pinned && pinned.length > 0 ? (
              <div className="px-4">
                <h2 className="mb-0.5 p-2 font-sans text-gray-400">Pinned</h2>
                {pinned.map((ship: string) => (
                  <MessagesSidebarItem key={ship} whom={ship} />
                ))}
                <h2 className="mt-2 p-2 font-sans text-gray-400">
                  Direct Messages
                </h2>
              </div>
            ) : null}
          </MessagesList>
        </MessagesScrollingContext.Provider>
      </nav>
    </div>
  );
}
