import { useDismissNavigate } from '@/logic/routing';
import {
  Theme,
  useCalm,
  useCalmSettingMutation,
  useShowDms,
  useShowDmsMutation,
  useTheme,
  useThemeMutation,
} from '@/state/settings';
import { isTalk } from '@/logic/utils';
import Dialog from './Dialog';
import Setting from './Setting';
import SettingDropdown from './SettingDropdown';

export default function SettingsDialog() {
  const {
    disableAvatars,
    disableNicknames,
    disableSpellcheck,
    disableRemoteContent,
    disableWayfinding,
  } = useCalm();
  const theme = useTheme();
  const showDms = useShowDms();
  const { mutate, status } = useThemeMutation();
  const dismiss = useDismissNavigate();
  const { mutate: toggleAvatars, status: avatarStatus } =
    useCalmSettingMutation('disableAvatars');
  const { mutate: toggleNicknames, status: nicknameStatus } =
    useCalmSettingMutation('disableNicknames');
  const { mutate: toggleSpellcheck, status: spellcheckStatus } =
    useCalmSettingMutation('disableSpellcheck');
  const { mutate: toggleRemoteContent, status: remoteContentStatus } =
    useCalmSettingMutation('disableRemoteContent');
  const { mutate: toggleWayfinding, status: wayfindingStatus } =
    useCalmSettingMutation('disableWayfinding');
  const { mutate: toggleShowDms, status: showDmsStatus } = useShowDmsMutation();

  const onOpenChange = (open: boolean) => {
    if (!open) {
      dismiss();
    }
  };

  return (
    <Dialog
      defaultOpen
      modal
      onOpenChange={onOpenChange}
      className="w-[340px] md:w-[500px]"
    >
      <div className="flex flex-col space-y-8">
        <span className="text-lg font-bold">App Settings</span>
        <div className="inner-section relative space-y-4">
          <div className="mb-6 flex flex-col">
            <h2 className="mb-2 text-lg font-bold">CalmEngine</h2>
            <span className="text-gray-600">
              Tune the behavior of attention-grabbing interfaces in{' '}
              {isTalk ? 'Talk' : 'Groups'}
            </span>
          </div>
          <Setting
            on={disableAvatars}
            toggle={() => toggleAvatars(!disableAvatars)}
            status={avatarStatus}
            name="Disable avatars"
          >
            <p className="leading-5 text-gray-600">
              Turn user-set visual avatars off and only display urbit sigils in{' '}
              {isTalk ? 'Talk' : 'Groups'}
            </p>
          </Setting>
          <Setting
            on={disableNicknames}
            toggle={() => toggleNicknames(!disableNicknames)}
            status={nicknameStatus}
            name="Disable nicknames"
          >
            <p className="leading-5 text-gray-600">
              Turn user-set nicknames off and only display urbit-style names
              across {isTalk ? 'Talk' : 'Groups'}
            </p>
          </Setting>
          <Setting
            on={disableWayfinding}
            toggle={() => toggleWayfinding(!disableWayfinding)}
            status={wayfindingStatus}
            name="Disable wayfinding"
          >
            <p className="leading-5 text-gray-600">
              Turn off the "wayfinding" helper menu menu in the bottom left of
              the {isTalk ? 'Talk' : 'Groups'} sidebar
            </p>
          </Setting>
        </div>
        <div className="inner-section relative space-y-4">
          <div className="mb-6 flex flex-col">
            <h2 className="mb-2 text-lg font-bold">Privacy</h2>
            <span className="text-gray-600">
              Limit your urbit’s ability to be read or tracked by clearnet
              services in {isTalk ? 'Talk' : 'Groups'}
            </span>
          </div>
          <Setting
            on={disableSpellcheck}
            toggle={() => toggleSpellcheck(!disableSpellcheck)}
            status={spellcheckStatus}
            name="Disable spell-check"
          >
            <p className="leading-5 text-gray-600">
              Turn spell-check off across all text inputs in{' '}
              {isTalk ? 'Talk' : 'Groups'}. Spell-check reads your keyboard
              input, which may be undesirable.
            </p>
          </Setting>
          <Setting
            on={disableRemoteContent}
            toggle={() => toggleRemoteContent(!disableRemoteContent)}
            status={remoteContentStatus}
            name="Disable remote content"
          >
            <p className="leading-5 text-gray-600">
              Turn off automatically-displaying media embeds across{' '}
              {isTalk ? 'Talk' : 'Groups'}. This may result in some software
              appearing to have content missing.
            </p>
          </Setting>
        </div>
        <div className="inner-section relative space-y-2">
          <div className="flex flex-col">
            <h2 className="mb-2 text-lg font-bold">Display</h2>
          </div>
          {!isTalk && (
            <Setting
              on={showDms}
              toggle={() => {
                toggleShowDms(!showDms);
              }}
              status={showDmsStatus}
              name="Show DMs"
            >
              <p className="leading-5 text-gray-600">
                Show DMs in the sidebar of {isTalk ? 'Talk' : 'Groups'}
              </p>
            </Setting>
          )}
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
              Change the color scheme of the Groups
            </p>
          </SettingDropdown>
        </div>
      </div>
    </Dialog>
  );
}
