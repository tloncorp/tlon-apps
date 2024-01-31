import cn from 'classnames';
import ob from 'urbit-ob';
import { NavLink, useLocation } from 'react-router-dom';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import GroupReference from '@/components/References/GroupReference';
import { useGang } from '@/state/groups';
import useGroupJoin from '@/groups/useGroupJoin';
import { useCalmSettingMutation } from '@/state/settings';
import { useIsMobile } from '@/logic/useMedia';
import { useDismissNavigate } from '@/logic/routing';
import Dialog from './Dialog';

function GroupsDescription() {
  const location = window.location.pathname;
  const groupFlagInLocation = ob.isValidPatp(location.split('/')[4] || '');

  return (
    <div className="flex flex-col leading-5">
      <h1 className="my-8 text-2xl font-bold">Where am I?</h1>
      <p>
        Tlon Corporation&rsquo;s &ldquo;Groups&rdquo; app, a multi-channel
        communications platform.
      </p>
      {groupFlagInLocation && (
        <p className="mt-4">
          You&rsquo;re currently within a group, which might have a variety of
          channels.
        </p>
      )}
      <h1 className="my-8 text-2xl font-bold">What can I do here?</h1>
      <p>
        Groups is designed as a “channel-based communications” software, which
        means that it works best when used with a group of people. You can join
        existing communities, or start your own.{' '}
      </p>
      <p className="mt-4">
        Here are some groups we recommend joining to learn more about Groups and
        how to use it in interesting ways:
      </p>
      <div className="mt-8 space-y-2">
        <GroupReference
          flag="~halbex-palheb/uf-public"
          plain
          description="Learn about the Urbit Project"
        />
        <GroupReference
          flag="~natnex-ronret/door-link"
          description="A cult of music lovers"
          plain
        />
        <GroupReference
          flag="~nibset-napwyn/tlon"
          description="A place to ask for help"
          plain
        />
      </div>
    </div>
  );
}

export default function LandscapeWayfinding() {
  const isMobile = useIsMobile();
  const gang = useGang('~nibset-napwyn/tlon');
  const { open } = useGroupJoin('~nibset-napwyn/tlon', gang, true);
  const location = useLocation();
  const { mutate } = useCalmSettingMutation('disableWayfinding');

  const handleHide = () => {
    mutate(true);
  };

  // Don't show the wayfinding button in DMs or Channels pages on mobile
  if (
    (isMobile && location.pathname.includes('dm')) ||
    location.pathname.includes('channels/') ||
    location.pathname.includes('profile/')
  ) {
    return null;
  }

  return (
    <Dropdown.Root>
      <div
        className={cn('fixed left-5 z-45', {
          'bottom-10': !isMobile,
          'bottom-20': isMobile,
        })}
      >
        <Dropdown.Trigger className="relative" asChild>
          <button className="h-9 w-9 cursor-pointer rounded-lg border-2 border-gray-100 bg-gray-50 text-base font-bold text-gray-800">
            ?
          </button>
        </Dropdown.Trigger>
        <Dropdown.Content
          side="bottom"
          sideOffset={8}
          className="dropdown mx-4 flex w-[208px] flex-col rounded-lg  drop-shadow-lg"
        >
          <Dropdown.Item asChild className="dropdown-item-blue">
            <NavLink
              to="/wayfinding"
              state={{ backgroundLocation: location }}
              className="cursor-pointer"
            >
              Basic Wayfinding
            </NavLink>
          </Dropdown.Item>
          <Dropdown.Separator asChild>
            <hr className="my-2 border-[1px] border-gray-50" />
          </Dropdown.Separator>
          <Dropdown.Item asChild className="dropdown-item">
            <NavLink to="/privacy" state={{ backgroundLocation: location }}>
              Privacy Notice
            </NavLink>
          </Dropdown.Item>
          <Dropdown.Item asChild className="dropdown-item">
            <button className="cursor-pointer" onClick={open}>
              Help & Support
            </button>
          </Dropdown.Item>
          <Dropdown.Item asChild className="dropdown-item">
            <a
              className="no-underline"
              href="https://airtable.com/shrflFkf5UyDFKhmW"
              target="_blank"
              rel="noreferrer"
            >
              Submit Feedback
            </a>
          </Dropdown.Item>
          <Dropdown.Item asChild className="dropdown-item">
            <button className="cursor-pointer" onClick={handleHide}>
              Hide This Button
            </button>
          </Dropdown.Item>
        </Dropdown.Content>
      </div>
    </Dropdown.Root>
  );
}

export function LandscapeWayfindingModal() {
  const dismiss = useDismissNavigate();
  const onOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      dismiss();
    }
  };

  return (
    <Dialog
      defaultOpen
      onOpenChange={onOpenChange}
      containerClass="md:w-1/2 w-full z-50"
      close="none"
    >
      <GroupsDescription />
    </Dialog>
  );
}
