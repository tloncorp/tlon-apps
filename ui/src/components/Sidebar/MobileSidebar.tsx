import React, { useState } from 'react';
import cn from 'classnames';
import { Outlet, useLocation } from 'react-router';
import { Link } from 'react-router-dom';
import { isNativeApp } from '@/logic/native';
import NavTab from '../NavTab';
import AppGroupsIcon from '../icons/AppGroupsIcon';
import BellIcon from '../icons/BellIcon';
import Sheet, { SheetContent } from '../Sheet';
import AsteriskIcon from '../icons/Asterisk16Icon';
import SidebarItem from './SidebarItem';
import PencilSettingsIcon from '../icons/PencilSettingsIcon';
import GridIcon from '../icons/GridIcon';
import HomeIconMobileNav from '../icons/HomeIconMobileNav';
import MagnifyingGlassMobileNavIcon from '../icons/MagnifyingGlassMobileNavIcon';
import MessagesIcon from '../icons/MessagesIcon';
import Avatar from '../Avatar';
import ShipName from '../ShipName';

export default function MobileSidebar() {
  const [showSheet, setShowSheet] = useState(false);
  const location = useLocation();
  const isInactive = (path: string) => location.pathname !== path;

  return (
    <section className="fixed inset-0 z-40 flex h-full w-full flex-col border-gray-50 bg-white">
      <Outlet />
      <footer className="flex-none border-t-2 border-gray-50">
        <nav>
          <ul className="flex">
            <NavTab to="/" linkClass="basis-1/5">
              <HomeIconMobileNav
                isInactive={isInactive('/')}
                className="mb-0.5 h-6 w-6"
              />
            </NavTab>
            {isNativeApp() && (
              <NavTab to="/messages" linkClass="basis-1/5">
                <MessagesIcon
                  isInactive={isInactive('/messages')}
                  className="mb-0.5 h-6 w-6"
                />
              </NavTab>
            )}
            <NavTab to="/notifications" linkClass="basis-1/5">
              <BellIcon
                isInactive={isInactive('/notifications')}
                className="mb-0.5 h-6 w-6"
              />
            </NavTab>
            <NavTab to="/find" linkClass="basis-1/5">
              <MagnifyingGlassMobileNavIcon
                isInactive={isInactive('/find')}
                className="mb-0.5 h-6 w-6"
              />
            </NavTab>
            {!isNativeApp() && (
              <NavTab to="/leap">
                <GridIcon
                  className={cn('mb-0.5 h-8 w-8', {
                    'text-gray-200': isInactive('/leap'),
                  })}
                />
              </NavTab>
            )}
            <NavTab to="/profile" linkClass="basis-1/5">
              <Avatar size="xs" className="mb-0.5" ship={window.our} />
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

                <SidebarItem
                  icon={<Avatar ship={window.our} />}
                  to={'/profile/edit'}
                  onClick={() => setShowSheet(false)}
                >
                  <ShipName showAlias name={window.our} />
                </SidebarItem>
              </Link>
            </SheetContent>
          </Sheet>
        </nav>
      </footer>
    </section>
  );
}
