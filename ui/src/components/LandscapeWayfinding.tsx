import React, { useState } from 'react';
import cn from 'classnames';
import ob from 'urbit-ob';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import useAppName from '@/logic/useAppName';
import GroupReference from '@/components/References/GroupReference';
import { useGang } from '@/state/groups';
import useGroupJoin from '@/groups/useGroupJoin';
import { setCalmSetting } from '@/state/settings';
import { useIsMobile } from '@/logic/useMedia';
import { useLocation } from 'react-router-dom';
import { isTalk } from '@/logic/utils';
import Dialog, { DialogContent } from './Dialog';

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

function TalkDescription() {
  return (
    <div className="flex flex-col leading-5">
      <h1 className="my-8 text-2xl font-bold">Where am I?</h1>
      <p>
        Tlon Corporation&rsquo;s “Talk” app, a simple, powerful, and secure
        instant messaging software for individuals or small groups of people.
      </p>
      <h1 className="my-8 text-2xl font-bold">What can I do here?</h1>
      <p>
        Talk is simple: It works like any other messaging app you&rsquo;ve ever
        used. What makes it special is its directly person-to-person nature, no
        one person or company can ever snoop the messages you send on Talk.
      </p>
      <p className="mt-4 mb-8">
        In addition to the experience you expect, Talk can also aggregate group
        communications from Groups and other software in the Urbit ecosystem.
      </p>
    </div>
  );
}

export default function LandscapeWayfinding() {
  const [showModal, setShowModal] = useState(false);
  const isMobile = useIsMobile();
  const app = useAppName();
  const gang = useGang('~nibset-napwyn/tlon');
  const { open } = useGroupJoin('~nibset-napwyn/tlon', gang);
  const location = useLocation();

  const handleHide = () => {
    setCalmSetting('disableWayfinding', true);
  };

  // Don't show the wayfinding button in DMs or Channels pages on mobile
  if (
    (isMobile && location.pathname.includes('dm')) ||
    location.pathname.includes('channels/')
  ) {
    return null;
  }

  return (
    <Dropdown.Root>
      <div
        className={cn('fixed left-5 z-50', {
          'bottom-10': !isMobile || (isTalk && isMobile),
          'bottom-20': isMobile && !isTalk,
        })}
      >
        <Dropdown.Trigger className="relative" asChild>
          <button className="h-9 w-9 cursor-pointer rounded-lg bg-black text-xl text-white">
            ?
          </button>
        </Dropdown.Trigger>
        <Dropdown.Content
          side="bottom"
          sideOffset={8}
          className="dropdown mx-4 flex w-[208px] flex-col space-y-3 rounded-lg bg-white p-2 text-sm font-semibold text-black drop-shadow-lg"
        >
          <Dropdown.Item asChild className="dropdown-item p-2">
            <span
              onClick={() => setShowModal(true)}
              className="cursor-pointer text-blue"
            >
              Basic Wayfinding
            </span>
          </Dropdown.Item>
          <Dropdown.Separator asChild>
            <hr className="my-2 border-[1px] border-gray-50" />
          </Dropdown.Separator>
          <Dropdown.Item asChild className="dropdown-item p-2">
            <span className="cursor-pointer" onClick={open}>
              Help & Support
            </span>
          </Dropdown.Item>
          <Dropdown.Item asChild className="dropdown-item p-2">
            <a
              className="no-underline"
              href="https://airtable.com/shrflFkf5UyDFKhmW"
              target="_blank"
              rel="noreferrer"
            >
              Submit Feedback
            </a>
          </Dropdown.Item>
          <Dropdown.Item asChild className="dropdown-item p-2">
            <span className="cursor-pointer" onClick={handleHide}>
              Hide This Button
            </span>
          </Dropdown.Item>
        </Dropdown.Content>
      </div>
      <Dialog open={showModal} onOpenChange={() => setShowModal(false)}>
        <DialogContent showClose={false}>
          {app === 'Groups' && <GroupsDescription />}
          {app === 'Talk' && <TalkDescription />}
        </DialogContent>
      </Dialog>
    </Dropdown.Root>
  );
}
