import { Link, useLocation } from 'react-router-dom';
import WidgetDrawer from '@/components/WidgetDrawer';
import { useDismissNavigate } from '@/logic/routing';
import HomeIconMobileNav from '@/components/icons/HomeIconMobileNav';
import BangIcon from '@/components/icons/BangIcon';

export default function GroupAddDialog() {
  const dismiss = useDismissNavigate();
  const location = useLocation();
  return (
    <WidgetDrawer
      onOpenChange={(o) => !o && dismiss()}
      className="px-6 py-12"
      open
    >
      <h1 className="text-center text-[17px] font-medium">Add a group</h1>
      <ul className="mt-6 divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-100">
        <li>
          <Link
            to="/groups/join"
            state={location.state}
            className="flex items-center gap-4 py-4 px-6 active:bg-gray-100"
          >
            <HomeIconMobileNav className="h-6 w-6" isInactive />
            <div className="space-y-1">
              <h2 className="text-[17px] font-medium">Join a group</h2>
              <p className="text-gray-400">
                Join with short code or host&apos;s Urbit ID
              </p>
            </div>
          </Link>
        </li>
        <li>
          <Link
            to="/groups/create"
            state={location.state}
            className="flex items-center gap-4 py-4 px-6 text-blue active:bg-gray-100"
          >
            <BangIcon className="h-6 w-6" />
            <div className="space-y-1">
              <h2 className="text-[17px] font-medium">Create new group</h2>
              <p className="text-gray-400">Start a group from scratch</p>
            </div>
          </Link>
        </li>
      </ul>
    </WidgetDrawer>
  );
}
