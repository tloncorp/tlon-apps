import { motion, AnimatePresence } from 'framer-motion';
import { debounce } from 'lodash';
import { useDismissNavigate } from '@/logic/routing';
import {
  useCalm,
  useCalmSettingMutation,
  useCustomTheme,
  useCustomThemeMutation,
  useResetCustomThemeMutation,
  useTheme,
  useThemeMutation,
} from '@/state/settings';
import { camelCaseToTitleCase, isTalk } from '@/logic/utils';
import { ThemeType } from '@/types/settings';
import Dialog from './Dialog';
import Setting from './Setting';
import SettingDropdown from './SettingDropdown';
import ColorPicker from './ColorPicker';

export default function SettingsDialog() {
  const {
    disableAvatars,
    disableNicknames,
    disableSpellcheck,
    disableRemoteContent,
    disableWayfinding,
  } = useCalm();
  const theme = useTheme();
  const { mutate, status } = useThemeMutation();
  const { mutate: customMutate } = useCustomThemeMutation();
  const { mutate: resetCustomThemeMutate } = useResetCustomThemeMutation();
  const customTheme = useCustomTheme();
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

  console.log({ customTheme });
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
        <div className="inner-section relative space-y-4">
          <div className="mb-6 flex flex-col">
            <h2 className="mb-2 text-lg font-bold">Theme</h2>
            <span className="text-gray-600">
              Change the color scheme of the {isTalk ? 'Talk' : 'Groups'}{' '}
              interface
            </span>
          </div>
          <SettingDropdown
            name="Set your theme"
            selected={{
              label: theme.charAt(0).toUpperCase() + theme.slice(1),
              value: theme,
            }}
            onChecked={(value) => {
              mutate(value as ThemeType);
            }}
            options={[
              { label: 'Auto', value: 'auto' },
              { label: 'Light', value: 'light' },
              { label: 'Dark', value: 'dark' },
              { label: 'Custom', value: 'custom' },
            ]}
            status={status}
          >
            <p className="leading-5 text-gray-600">
              Change the color scheme of the {isTalk ? 'Talk' : 'Groups'}{' '}
            </p>
          </SettingDropdown>
        </div>
        <AnimatePresence initial={false}>
          {theme === 'custom' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="inner-section relative space-y-4"
            >
              <button
                className="button"
                onClick={() => {
                  resetCustomThemeMutate();
                }}
              >
                Reset to default
              </button>
              {Object.keys(customTheme).map((key) => (
                <div className="flex items-center rounded-lg bg-gray-50 px-4 py-2">
                  <ColorPicker
                    color={customTheme[key as keyof typeof customTheme]}
                    key={key}
                    inputClassName="input bg-white w-24 mx-2"
                    setColor={(color: string) => {
                      debounce(() => {
                        customMutate({
                          ...customTheme,
                          [key as keyof typeof customTheme]: color,
                        });
                      }, 300)();
                    }}
                  />
                  <span className="font-semibold">
                    {camelCaseToTitleCase(key)}
                  </span>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Dialog>
  );
}
