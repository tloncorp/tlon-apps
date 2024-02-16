import Dialog from '@/components/Dialog';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import ShipConnection from '@/components/ShipConnection';
import ShipName from '@/components/ShipName';
import WidgetDrawer from '@/components/WidgetDrawer';
import Globe16Icon from '@/components/icons/Globe16Icon';
import Lock16Icon from '@/components/icons/Lock16Icon';
import Private16Icon from '@/components/icons/Private16Icon';
import GroupSummary from '@/groups/GroupSummary';
import useGroupJoin from '@/groups/useGroupJoin';
import { useDismissNavigate } from '@/logic/routing';
import { useIsMobile } from '@/logic/useMedia';
import {
  getFlagParts,
  getPrivacyFromPreview,
  matchesBans,
  pluralRank,
  toTitleCase,
} from '@/logic/utils';
import {
  groupIsInitializing,
  useGang,
  useGangPreview,
  useGroupJoinInProgress,
  useRouteGroup,
} from '@/state/groups';
import { useConnectivityCheck } from '@/state/vitals';
import cn from 'classnames';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

import GroupAvatar from '../GroupAvatar';

const LONG_JOIN_THRESHOLD = 10 * 1000;

function getGroupHeading(title: string, flag: string) {
  if (!title) return flag;
  return title.length > 60 ? `${title.slice(0, 59).trim()}...` : title;
}

export function MobileGroupPreview({
  flag,
  closeOnJoin,
}: {
  flag: string;
  closeOnJoin?: () => void;
}) {
  const [showLongJoinMessage, setShowLongJoinMessage] = useState(false);
  const navigate = useNavigate();
  const gang = useGang(flag);
  const { ship } = getFlagParts(flag);
  const preview = useGangPreview(flag);
  const privacy = preview ? getPrivacyFromPreview(preview) : null;
  const joinAlreadyInProgress = useGroupJoinInProgress(flag);
  const { data } = useConnectivityCheck(ship, { enabled: true });
  const { group, reject, button, status, newlyJoined } = useGroupJoin(
    flag,
    gang,
    true,
    undefined
  );
  const cordon = preview?.cordon || group?.cordon;
  const banned = cordon ? matchesBans(cordon, window.our) : null;
  const isJoining = status === 'loading' || joinAlreadyInProgress;
  const readyToNavigate = group && !groupIsInitializing(group);

  useEffect(() => {
    if (readyToNavigate && newlyJoined) {
      if (closeOnJoin) {
        closeOnJoin();
      } else {
        navigate(`/groups/${flag}`);
      }
    }
  }, [readyToNavigate, flag, navigate, newlyJoined, closeOnJoin]);

  useEffect(() => {
    if (isJoining && !readyToNavigate && !showLongJoinMessage) {
      setTimeout(() => {
        setShowLongJoinMessage(true);
      }, LONG_JOIN_THRESHOLD);
    }
  }, [isJoining, readyToNavigate, showLongJoinMessage]);

  return (
    <>
      <div className="mt-6 flex w-full items-center">
        <GroupAvatar
          {...preview?.meta}
          className="flex-none"
          size="h-14 w-14"
        />
        <div className="ml-4">
          <h3
            className={cn(
              'mb-1 font-semibold',
              preview?.meta.title && 'text-xl leading-snug'
            )}
          >
            {getGroupHeading(preview?.meta.title || '', flag)}
          </h3>
          <p className="mb-1 text-gray-400">
            Hosted by <ShipName name={ship} />
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-gray-600">
            {privacy ? (
              <span className="inline-flex items-center space-x-1 capitalize">
                {privacy === 'public' ? (
                  <Globe16Icon className="h-4 w-4" />
                ) : privacy === 'private' ? (
                  <Lock16Icon className="h-4 w-4" />
                ) : (
                  <Private16Icon className="h-4 w-4" />
                )}
                <span>{privacy}</span>
              </span>
            ) : null}
            {data && (
              <ShipConnection
                type="combo"
                ship={ship}
                status={data?.status}
                agent="channels-server"
                app="channels"
              />
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 flex w-full items-center">
        <p>{preview?.meta.description}</p>
      </div>

      <div className="mt-12 flex w-full justify-end">
        {banned ? (
          <span className="inline-block px-2 font-semibold text-gray-600">
            {banned === 'ship'
              ? "You've been banned from this group"
              : `${toTitleCase(pluralRank(banned))} are banned`}
          </span>
        ) : (
          <>
            {gang.invite && status !== 'loading' ? (
              <button
                className="button bg-red text-white dark:text-black"
                onClick={reject}
              >
                Reject Invite
              </button>
            ) : null}
            {isJoining ? (
              <div className="mt-4 flex w-full flex-col items-center">
                <div className="flex items-center">
                  <span className="mr-2">
                    {showLongJoinMessage
                      ? 'Joining may take a bit...'
                      : 'Joining...'}
                  </span>
                  <LoadingSpinner className="h-5 w-4" />
                </div>
                {showLongJoinMessage && (
                  <p className="mt-3 px-8 text-sm text-gray-400">
                    No need to keep waiting here, the group will finish joining
                    in the background.
                  </p>
                )}
              </div>
            ) : status === 'error' ? (
              <span className="text-red-500">Error</span>
            ) : (
              <button
                className="button ml-2 bg-blue text-white dark:text-black"
                onClick={button.action}
                disabled={button.disabled}
              >
                {button.text}
              </button>
            )}
          </>
        )}
      </div>
    </>
  );
}

export function DesktopGroupPreview({ flag }: { flag: string }) {
  const navigate = useNavigate();
  const gang = useGang(flag);
  const preview = useGangPreview(flag);
  const { group, reject, button, status } = useGroupJoin(
    flag,
    gang,
    true,
    undefined
  );
  const cordon = preview?.cordon || group?.cordon;
  const banned = cordon ? matchesBans(cordon, window.our) : null;
  const readyToNavigate = group && !groupIsInitializing(group);

  useEffect(() => {
    if (readyToNavigate) {
      navigate(`/groups/${flag}`);
    }
  }, [readyToNavigate, flag, navigate]);

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold">Join This Group</h2>
      <GroupSummary flag={flag} preview={gang.preview} />
      <p>{gang.preview?.meta.description}</p>
      <div className="flex items-center justify-end space-x-2">
        <button
          className="secondary-button mr-auto bg-transparent"
          onClick={() => navigate(-1)}
        >
          Back
        </button>
        {banned ? (
          <span className="inline-block px-2 font-semibold text-gray-600">
            {banned === 'ship'
              ? "You've been banned from this group"
              : `${toTitleCase(pluralRank(banned))} are banned`}
          </span>
        ) : (
          <>
            {gang.invite && status !== 'loading' ? (
              <button
                className="button bg-red text-white dark:text-black"
                onClick={reject}
              >
                Reject Invite
              </button>
            ) : null}
            {status === 'loading' ? (
              <div className="flex items-center space-x-2">
                <span className="text-gray-400">Joining...</span>
                <LoadingSpinner className="h-5 w-4" />
              </div>
            ) : status === 'error' ? (
              <span className="text-red-500">Error</span>
            ) : (
              <button
                className="button ml-2 bg-blue text-white dark:text-black"
                onClick={button.action}
                disabled={button.disabled}
              >
                {button.text}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function GroupPreviewModal({
  flag,
  open,
  onClose,
}: {
  flag?: string;
  open?: boolean;
  onClose?: () => void;
}) {
  const routeFlag = useRouteGroup();
  const groupFlag = flag ?? routeFlag;
  const isMobile = useIsMobile();
  const dismiss = useDismissNavigate();

  const onOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      if (onClose) {
        onClose();
      } else {
        dismiss();
      }
    }
  };

  if (isMobile) {
    return (
      <WidgetDrawer
        open={true}
        onOpenChange={onOpenChange}
        className="h-[60vh] px-8"
      >
        <MobileGroupPreview flag={groupFlag} />
      </WidgetDrawer>
    );
  }

  return (
    <Dialog
      defaultOpen={open === undefined}
      open={open === undefined ? undefined : open}
      onOpenChange={() => dismiss()}
      containerClass="w-full max-w-md"
    >
      <DesktopGroupPreview flag={groupFlag} />
    </Dialog>
  );
}
