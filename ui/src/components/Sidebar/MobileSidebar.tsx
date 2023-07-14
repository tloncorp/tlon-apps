import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router';
import { Link } from 'react-router-dom';
import NavTab from '../NavTab';
import AppGroupsIcon from '../icons/AppGroupsIcon';
import ElipsisIcon from '../icons/EllipsisIcon';
import BellIcon from '../icons/BellIcon';
import Sheet, { SheetContent } from '../Sheet';
import MagnifyingGlassIcon from '../icons/MagnifyingGlass16Icon';
import GridIcon from '../icons/GridIcon';
import AsteriskIcon from '../icons/Asterisk16Icon';
import SidebarItem from './SidebarItem';
import PencilSettingsIcon from '../icons/PencilSettingsIcon';

export default function MobileSidebar() {
  const [showSheet, setShowSheet] = useState(false);
  const location = useLocation();

  return (
    <section className="fixed inset-0 z-40 flex h-full w-full flex-col  border-gray-50 bg-white">
      <Outlet />
      <footer className="flex-none border-t-2 border-gray-50">
        <nav>
          <ul className="flex">
            <NavTab to="/" linkClass="basis-1/5">
              <AppGroupsIcon className="mb-0.5 h-6 w-6" />
              Groups
            </NavTab>
            <NavTab to="/notifications" linkClass="basis-1/5">
              <BellIcon className="mb-0.5 h-6 w-6" />
              Activity
            </NavTab>
            <NavTab to="/find" linkClass="basis-1/5">
              <MagnifyingGlassIcon className="mb-0.5 h-6 w-6" />
              Discover
            </NavTab>
            <NavTab to="/leap">
              <GridIcon className="-mx-1 h-7 w-7" />
              Leap
            </NavTab>
            <NavTab onClick={() => setShowSheet(true)} linkClass="basis-1/5">
              <ElipsisIcon className="mb-0.5 h-6 w-6" />
              Options
            </NavTab>
          </ul>
          <Sheet open={showSheet} onOpenChange={(o) => setShowSheet(o)}>
            <SheetContent containerClass="" showClose={true}>
              <a
                className="no-underline"
                href="https://airtable.com/shrflFkf5UyDFKhmW"
                target="_blank"
                rel="noreferrer"
                aria-label="Submit Feedback"
              >
                <SidebarItem
                  icon={
                    <div className="flex h-12 w-12 items-center justify-center rounded-md bg-gray-50">
                      <AsteriskIcon className="h-6 w-6" />
                    </div>
                  }
                  onClick={() => setShowSheet(false)}
                >
                  Submit Feedback
                </SidebarItem>
              </a>
              <Link
                to="/about"
                className="no-underline"
                state={{ backgroundLocation: location }}
              >
                <SidebarItem
                  icon={
                    <div className="flex h-12 w-12 items-center justify-center rounded-md bg-gray-50">
                      <AppGroupsIcon className="h-6 w-6" />
                    </div>
                  }
                  onClick={() => setShowSheet(false)}
                >
                  About Groups
                </SidebarItem>
              </Link>
              <Link
                to="/settings"
                className="no-underline"
                state={{ backgroundLocation: location }}
              >
                <SidebarItem
                  icon={
                    <div className="flex h-12 w-12 items-center justify-center rounded-md bg-gray-50">
                      <PencilSettingsIcon className="h-6 w-6" />
                    </div>
                  }
                  onClick={() => setShowSheet(false)}
                >
                  App Settings
                </SidebarItem>
              </Link>
            </SheetContent>
          </Sheet>
        </nav>
      </footer>
    </section>
  );
}
