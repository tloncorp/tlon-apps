import { useMutation } from '@tanstack/react-query';
import { ActivityAction, ActivityUpdate } from '@tloncorp/shared/dist/urbit';
import cn from 'classnames';
import { useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';

import api from '@/api';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import { useIsMobile } from '@/logic/useMedia';
import { activityAction } from '@/state/activity';
import {
  Theme,
  useCalm,
  useCalmSettingMutation,
  useLogActivity,
  usePutEntryMutation,
  useResetAnalyticsIdMutation,
  useTheme,
  useThemeMutation,
} from '@/state/settings';

import VolumeSetting from '../VolumeSetting';
import Setting from './Setting';
import SettingDropdown from './SettingDropdown';

export default function Settings() {
  const location = useLocation();
  const isMobile = useIsMobile();
  const logActivity = useLogActivity();
  const {
    disableAvatars,
    disableNicknames,
    disableSpellcheck,
    disableRemoteContent,
    showUnreadCounts,
  } = useCalm();
  const theme = useTheme();
  const { mutate, status } = useThemeMutation();
  const { mutate: toggleAvatars, status: avatarStatus } =
    useCalmSettingMutation('disableAvatars');
  const { mutate: toggleNicknames, status: nicknameStatus } =
    useCalmSettingMutation('disableNicknames');
  const { mutate: toggleSpellcheck, status: spellcheckStatus } =
    useCalmSettingMutation('disableSpellcheck');
  const { mutate: toggleRemoteContent, status: remoteContentStatus } =
    useCalmSettingMutation('disableRemoteContent');
  const { mutate: toggleShowCounts, status: showCountsStatus } =
    useCalmSettingMutation('showUnreadCounts');
  const { mutate: toggleLogActivity, status: logActivityStatus } =
    usePutEntryMutation({ bucket: window.desk, key: 'logActivity' });
  const { mutate: resetAnalyticsId, status: resetAnalyticsIdStatus } =
    useResetAnalyticsIdMutation();
  const { mutate: markRead, isLoading } = useMutation({
    mutationFn: async () => {
      await api.trackedPoke<ActivityAction, ActivityUpdate>(
        activityAction({
          read: {
            source: { base: null },
            action: { all: { time: null, deep: true } },
          },
        }),
        { app: 'activity', path: '/v4' },
        (event) => 'activity' in event
      );

      await new Promise((res) => setTimeout(res, 1000));
    },
  });
  const isMarkReadPending = isLoading;
  const markAllRead = useCallback(async () => {
    markRead();
  }, []);

  return (
    <>
      <div className="card">
        <div className="flex flex-col items-start space-y-2">
          <h2 className="text-lg font-semibold">Activity</h2>
          <p className="text-gray-600">
            Mark all channels, DMs, and threads read (aka get rid of dots)
          </p>
          <button
            disabled={isMarkReadPending}
            className={cn('small-button whitespace-nowrap text-sm min-w-10', {
              'bg-gray-400 text-gray-800': isMarkReadPending,
            })}
            onClick={markAllRead}
          >
            {isMarkReadPending ? (
              <LoadingSpinner className="h-4 w-4" />
            ) : (
              `Mark Everything as Read`
            )}
          </button>
        </div>
      </div>
      <div className="card">
        <div className="flex flex-col">
          <h2 className="mb-2 text-lg font-semibold">Blocked Users</h2>
          <div className="flex flex-row items-center space-x-2">
            <Link
              state={{ backgroundLocation: location.state?.backgroundLocation }}
              to={'blocked'}
              className="small-button"
            >
              Manage Blocked Users
            </Link>
          </div>
        </div>
      </div>
      <div className="card">
        <div className="mb-4 flex flex-col">
          <h2 className="mb-2 text-lg font-semibold">CalmEngine</h2>
          <span className="leading-5 text-gray-600">
            Tune the behavior of attention-grabbing interfaces in Tlon
          </span>
        </div>
        <Setting
          on={showUnreadCounts}
          toggle={() => toggleShowCounts(!showUnreadCounts)}
          status={showCountsStatus}
          name="Show unread counts"
          labelClassName="font-semibold"
        >
          <p className="mb-4 leading-5 text-gray-600">
            Show the number of unread activity in each channel and group
          </p>
        </Setting>
        <Setting
          on={disableAvatars}
          toggle={() => toggleAvatars(!disableAvatars)}
          status={avatarStatus}
          name="Disable avatars"
          labelClassName="font-semibold"
        >
          <p className="mb-4 leading-5 text-gray-600">
            Turn user-set visual avatars off and only display urbit sigils in
            Tlon
          </p>
        </Setting>
        <Setting
          on={disableNicknames}
          toggle={() => toggleNicknames(!disableNicknames)}
          status={nicknameStatus}
          name="Disable nicknames"
          labelClassName="font-semibold"
        >
          <p className="leading-5 text-gray-600">
            Turn user-set nicknames off and only display Urbit-style names
            across Tlon
          </p>
        </Setting>
      </div>
      <div className="card">
        <div className="mb-4 flex flex-col">
          <h2 className="mb-2 text-lg font-semibold">Notifications</h2>
          <span className="text-gray-600">
            Control how notifications are delivered. These settings can be
            overriden for individual channels and groups.
          </span>
        </div>
        <section>
          <div className="flex space-x-2">
            <VolumeSetting source={{ base: null }} />
          </div>
        </section>
      </div>
      <div className="card">
        <div className="mb-4 flex flex-col">
          <h2 className="mb-2 text-lg font-semibold">Privacy</h2>
          <span className="text-gray-600">
            Limit your urbit’s ability to be read or tracked by clearnet
            services
          </span>
        </div>
        <Setting
          on={logActivity}
          toggle={() => toggleLogActivity({ val: !logActivity })}
          status={logActivityStatus}
          name="Log Usage"
          labelClassName="font-semibold"
        >
          <p className="mb-4 leading-5 text-gray-600">
            Enable or disable basic activity tracking. Tlon uses this data to
            make product decisions and to bring you a better experience.{' '}
            <Link
              className="text-underline text-blue"
              to="/privacy"
              state={{ backgroundLocation: location }}
            >
              Read about our approach to activity tracking and personal privacy.
            </Link>
          </p>
        </Setting>
        {logActivity && (
          <div className="mb-4 flex flex-col space-y-2 pl-8">
            <div className="flex flex-row space-x-2">
              <button
                onClick={() => resetAnalyticsId()}
                className="small-button"
                disabled={resetAnalyticsIdStatus === 'loading'}
              >
                {resetAnalyticsIdStatus === 'loading' ? (
                  <LoadingSpinner />
                ) : (
                  'Reset Analytics ID'
                )}
              </button>
            </div>
          </div>
        )}
        <Setting
          on={disableSpellcheck}
          toggle={() => toggleSpellcheck(!disableSpellcheck)}
          status={spellcheckStatus}
          name="Disable spell-check"
          labelClassName="font-semibold"
        >
          <p className="mb-2 leading-5 text-gray-600">
            Turn spell-check off across all text inputs in Tlon. Spell-check
            reads your keyboard input, which may be undesirable.
          </p>
        </Setting>
        <Setting
          on={disableRemoteContent}
          toggle={() => toggleRemoteContent(!disableRemoteContent)}
          status={remoteContentStatus}
          name="Disable remote content"
          labelClassName="font-semibold"
        >
          <p className="leading-5 text-gray-600">
            Turn off automatically-displaying media embeds across Tlon. This may
            result in some content to appear missing.
          </p>
        </Setting>
      </div>
      <div className="card">
        <div className="flex flex-col">
          <h2 className="mb-2 text-lg font-semibold">Theme</h2>
        </div>
        <SettingDropdown
          name="Set your theme"
          selected={{
            label: theme.charAt(0).toUpperCase() + theme.slice(1),
            value: theme,
          }}
          onChecked={(value) => {
            mutate(value as Theme);
          }}
          options={[
            { label: 'Auto', value: 'auto' },
            { label: 'Light', value: 'light' },
            { label: 'Dark', value: 'dark' },
          ]}
          status={status}
        >
          <p className="leading-5 text-gray-600">
            Change the color scheme of the Tlon app
          </p>
        </SettingDropdown>
      </div>
    </>
  );
}
