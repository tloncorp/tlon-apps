import React from 'react';
import { Link } from 'react-router-dom';

import NewMessageIcon from '../components/icons/NewMessageIcon';

export default function DMHome() {
  return (
    <section className="flex h-full w-full items-center justify-center bg-gray-50">
      {/* <div className="space-y-4 text-center">
        <h1 className="text-lg font-bold">Start a New Message or Group Chat</h1>
        <Link
          to="new"
          className="button bg-blue px-2 py-1 text-white dark:text-black"
        >
          <NewMessageIcon className="h-6 w-6" />
          <span className="mx-2">New Message</span>
        </Link>
      </div> */}
    </section>
  );
}
