import { useDismissNavigate } from '@/logic/routing';
import { useCalm, useCalmSettingMutation } from '@/state/settings';
import { isTalk } from '@/logic/utils';
import Dialog from './Dialog';
import Setting from './Setting';

export default function SettingsDialog() {
  const {
    disableAvatars,
    disableNicknames,
    disableSpellcheck,
    disableRemoteContent,
    disableWayfinding,
  } = useCalm();
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
  const onOpenChange = (open: boolean) => {
    if (!open) {
      dismiss();
    }
  };

  return (
    <Dialog defaultOpen modal onOpenChange={onOpenChange} className="w-[500px]">
      <div className="flex flex-col space-y-2">
        <span className="text-lg font-bold">
          {isTalk ? 'Talk' : 'Groups'} Settings
        </span>
        <div className="flex flex-col space-y-4">
          <div className="inner-section relative space-y-8">
            <h2 className="h4">CalmEngine</h2>
            <span className="font-semibold text-gray-400">
              Modulate attention-hacking interfaces across your urbit
            </span>
            <Setting
              on={disableAvatars}
              toggle={() => toggleAvatars(!disableAvatars)}
              status={avatarStatus}
              name="Disable avatars"
            >
              <p className="leading-5 text-gray-600">
                Turn user-set visual avatars off and only display urbit sigils
                across all of your apps.
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
                across all of your apps.
              </p>
            </Setting>
            <Setting
              on={disableWayfinding}
              toggle={() => toggleWayfinding(!disableWayfinding)}
              status={wayfindingStatus}
              name="Disable wayfinding"
            >
              <p className="leading-5 text-gray-600">
                Turn off the "wayfinding" menu in the bottom left of Landscape.
              </p>
            </Setting>
          </div>
          <div className="inner-section relative space-y-8">
            <h2 className="h4">Privacy</h2>
            <span className="font-semibold text-gray-400">
              Limit your urbit’s ability to be read or tracked by clearnet
              services
            </span>
            <Setting
              on={disableSpellcheck}
              toggle={() => toggleSpellcheck(!disableSpellcheck)}
              status={spellcheckStatus}
              name="Disable spell-check"
            >
              <p className="leading-5 text-gray-600">
                Turn spell-check off across all text inputs in your urbit’s
                software/applications. Spell-check reads your keyboard input,
                which may be undesirable.
              </p>
            </Setting>
            <Setting
              on={disableRemoteContent}
              toggle={() => toggleRemoteContent(!disableRemoteContent)}
              status={remoteContentStatus}
              name="Disable remote content"
            >
              <p className="leading-5 text-gray-600">
                Turn off automatically-displaying media embeds across all of
                your urbit’s software/applications. This may result in some
                software appearing to have content missing.
              </p>
            </Setting>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
