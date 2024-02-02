import * as db from '@db';
import {Sheet, SheetHeader} from '@ochre/Sheet';
import React, {useCallback, useEffect, useState} from 'react';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {TabEditor} from './TabEditor';
import {tabSettingsWithDefaults} from '@utils/useTabSettings';

export function TabEditorSheet({
  isOpen,
  onClose,
  onPressCancel,
  onPressDeleteTab,
  onPressSubmit,
  tabSettings,
}: {
  isOpen: boolean;
  onClose: () => void;
  tabSettings?: db.TabSettings | null;
  onPressDeleteTab: () => void;
  onPressSubmit: (settings: db.TabSettings) => void;
  onPressCancel: () => void;
}) {
  const [newTabSettings, setNewTabSettings] = useState<db.TabSettings>(() =>
    tabSettingsWithDefaults(tabSettings),
  );

  useEffect(() => {
    if (tabSettings) {
      setNewTabSettings(JSON.parse(JSON.stringify(tabSettings)));
    }
  }, [tabSettings]);

  const handlePressSubmit = useCallback(() => {
    return onPressSubmit(newTabSettings);
  }, [newTabSettings, onPressSubmit]);

  const handleOpenChanged = useCallback(
    (newIsOpen: boolean) => {
      if (!newIsOpen) {
        onClose();
      }
    },
    [onClose],
  );

  const insets = useSafeAreaInsets();

  return (
    <Sheet
      open={isOpen}
      onOpenChange={handleOpenChanged}
      unmountChildrenWhenHidden={true}
      modal={true}
      dismissOnSnapToBottom={true}>
      <Sheet.Overlay />
      <Sheet.Frame borderRadius={'$l'}>
        <SheetHeader>
          <SheetHeader.LeftControls>
            <SheetHeader.Button onPress={onPressCancel}>
              <SheetHeader.ButtonText>Cancel</SheetHeader.ButtonText>
            </SheetHeader.Button>
          </SheetHeader.LeftControls>
          <SheetHeader.Title>
            <SheetHeader.TitleText>
              {tabSettings ? 'Edit Tab' : 'Add Tab'}
            </SheetHeader.TitleText>
          </SheetHeader.Title>
          <SheetHeader.RightControls>
            <SheetHeader.Button onPress={handlePressSubmit}>
              <SheetHeader.ButtonText>Done</SheetHeader.ButtonText>
            </SheetHeader.Button>
          </SheetHeader.RightControls>
        </SheetHeader>
        <Sheet.ScrollView
          contentContainerStyle={{paddingBottom: insets.bottom}}>
          <TabEditor
            value={newTabSettings}
            onChange={setNewTabSettings}
            onPressDelete={onPressDeleteTab}
          />
        </Sheet.ScrollView>
      </Sheet.Frame>
    </Sheet>
  );
}

TabEditorSheet.displayName = 'TabEditorSheet';
