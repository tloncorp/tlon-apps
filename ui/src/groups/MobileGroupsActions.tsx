import React from 'react';
import SidebarItem from '@/components/Sidebar/SidebarItem';
import AsteriskIcon from '@/components/icons/Asterisk16Icon';

export default function MobileGroupsActions() {
  return (
    <nav className="h-full flex-1 overflow-y-auto p-2">
      <ul className="space-y-3">
        <SidebarItem
          icon={
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-gray-50">
              <AsteriskIcon className="h-6 w-6" />
            </div>
          }
        >
          <a
            className="no-underline"
            href="https://airtable.com/shrflFkf5UyDFKhmW"
            target="_blank"
            rel="noreferrer"
            aria-label="Submit Feedback"
          >
            Submit Feedback
          </a>
        </SidebarItem>
      </ul>
    </nav>
  );
}
