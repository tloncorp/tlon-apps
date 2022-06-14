import React from 'react';
import CaretLeftIcon from '../icons/CaretLeftIcon';
import useNavStore from '../Nav/useNavStore';
import ChannelList from './ChannelList';

export default function MobileGroupSidebar() {
  const { navSetMain, flag, secondary } = useNavStore((state) => ({
    navSetMain: state.setLocationMain,
    flag: state.flag,
    secondary: state.secondary,
  }));

  return (
    <section className="fixed inset-0 z-40 flex h-full w-full flex-col overflow-x-hidden border-r-2 border-gray-50 bg-white">
      <header className="px-2 py-1">
        <button
          className="default-focus inline-flex items-center rounded-lg p-2 text-xl font-medium text-gray-800 hover:bg-gray-50"
          onClick={navSetMain}
        >
          <CaretLeftIcon className="mr-4 h-6 w-6 text-gray-400" />
          {secondary === 'main'
            ? 'Channels'
            : secondary === 'notifications'
            ? 'Notifications'
            : secondary === 'search'
            ? 'Search Channels'
            : secondary === 'all'
            ? 'All Channels'
            : null}
        </button>
      </header>
      <div className="h-full w-full overflow-y-auto p-2">
        {secondary === 'main' ? (
          <ChannelList flag={flag} />
        ) : secondary === 'notifications' ? (
          <div />
        ) : secondary === 'search' ? (
          <div />
        ) : secondary === 'all' ? (
          <div />
        ) : null}
      </div>
      <footer className="mt-auto border-t-2 border-gray-50">
        <nav>
          <ul>
            <li />
          </ul>
        </nav>
      </footer>
    </section>
  );
}
