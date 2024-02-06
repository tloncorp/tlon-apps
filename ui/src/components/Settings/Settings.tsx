import { Link, useLocation } from 'react-router-dom';
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
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import { useIsMobile } from '@/logic/useMedia';
import Setting from './Setting';
import SettingDropdown from './SettingDropdown';
import VolumeSetting from '../VolumeSetting';

export default function Settings() {
  const location = useLocation();
  const isMobile = useIsMobile();
  const logActivity = useLogActivity();
  const {
    disableAvatars,
    disableNicknames,
    disableSpellcheck,
    disableRemoteContent,
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
  const { mutate: toggleLogActivity, status: logActivityStatus } =
    usePutEntryMutation({ bucket: window.desk, key: 'logActivity' });
  const { mutate: resetAnalyticsId, status: resetAnalyticsIdStatus } =
    useResetAnalyticsIdMutation();

  return (
    <div className="flex flex-col space-y-8">
      {!isMobile ? (
        <span className="text-lg font-bold">App Settings</span>
      ) : null}
      <div className="space-y-4">
        <div className="flex flex-col">
          <h2 className="mb-2 text-lg font-bold">Blocked Users</h2>
          <div className="flex flex-row items-center space-x-2">
            <Link
              state={{ backgroundLocation: location.state?.backgroundLocation }}
              to={isMobile ? './blocked' : '/blocked'}
              className="small-button"
            >
              Manage Blocked Users
            </Link>
          </div>
        </div>
      </div>
      <div className="space-y-4">
        <div className="mb-6 flex flex-col">
          <h2 className="mb-2 text-lg font-bold">CalmEngine</h2>
          <span className="text-gray-600">
            Tune the behavior of attention-grabbing interfaces in Tlon
          </span>
        </div>
        <Setting
          on={disableAvatars}
          toggle={() => toggleAvatars(!disableAvatars)}
          status={avatarStatus}
          name="Disable avatars"
          labelClassName="font-semibold"
        >
          <p className="leading-5 text-gray-600">
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
            Turn user-set nicknames off and only display urbit-style names
            across Tlon
          </p>
        </Setting>
      </div>
      <div className="space-y-4">
        <div className="mb-6 flex flex-col">
          <h2 className="mb-2 text-lg font-bold">Notifications</h2>
          <span className="text-gray-600">
            Control how notifications are delivered. These settings can be
            overriden for individual channels and groups.
          </span>
        </div>
        <section>
          <div className="flex space-x-2">
            <VolumeSetting />
          </div>
        </section>
      </div>
      <div className="space-y-4">
        <div className="mb-6 flex flex-col">
          <h2 className="mb-2 text-lg font-bold">Privacy</h2>
          <span className="text-gray-600">
            Limit your urbit’s ability to be read or tracked by clearnet
            services in Tlon
          </span>
        </div>
        <Setting
          on={logActivity}
          toggle={() => toggleLogActivity({ val: !logActivity })}
          status={logActivityStatus}
          name="Log Usage"
          labelClassName="font-semibold"
        >
          <p className="leading-5 text-gray-600">
            Enable or disable basic activity tracking. Tlon uses this
            data to make product decisions and to bring you a better Groups
            experience.
          </p>
        </Setting>
        {logActivity && (
          <div className="flex flex-col items-center space-y-2">
            <div className="flex flex-row items-center space-x-2">
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
          <p className="leading-5 text-gray-600">
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
            result in some software appearing to have content missing.
          </p>
        </Setting>
      </div>
      <div className="space-y-2">
        <div className="flex flex-col">
          <h2 className="mb-2 text-lg font-bold">Theme</h2>
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
            Change the color scheme of the Tlon
          </p>
        </SettingDropdown>
      </div>
    </div>
  );
}
