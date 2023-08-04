import cn from 'classnames';
import { Outlet, useLocation } from 'react-router';
import { isNativeApp } from '@/logic/native';
import NavTab from '../NavTab';
import BellIcon from '../icons/BellIcon';
import GridIcon from '../icons/GridIcon';
import HomeIconMobileNav from '../icons/HomeIconMobileNav';
import MagnifyingGlassMobileNavIcon from '../icons/MagnifyingGlassMobileNavIcon';
import MessagesIcon from '../icons/MessagesIcon';
import Avatar from '../Avatar';

export default function MobileSidebar() {
  const location = useLocation();
  const isInactive = (path: string) => location.pathname !== path;

  return (
    <section className="fixed inset-0 z-40 flex h-full w-full flex-col border-gray-50 bg-white pt-4">
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
            {!isNativeApp() && (
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
            {isNativeApp() && (
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
        </nav>
      </footer>
    </section>
  );
}
