import * as db from '@db';
import {Button, XStack, YStack} from '@ochre';
import React, {useCallback} from 'react';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useSheet} from 'tamagui';

export function SettingsPanel() {
  const realm = db.useRealm();
  const handlePressLogout = useCallback(() => {
    realm.write(() => {
      realm.delete(realm.objects('Account')[0]);
    });
  }, [realm]);

  const {setOpen} = useSheet();

  const handlePressManageSync = useCallback(() => {
    setOpen(true);
  }, [setOpen]);

  const safeAreaInsets = useSafeAreaInsets();

  return (
    <>
      <YStack
        alignItems={'flex-start'}
        flex={1}
        gap={'$m'}
        borderLeftWidth={1}
        borderColor={'$color'}
        paddingTop={safeAreaInsets.top}
        paddingHorizontal="$m">
        <XStack gap="$s" alignItems="flex-start">
          <Button
            borderRadius={'$m'}
            onPress={handlePressManageSync}
            borderColor="$border">
            <Button.Text size="$m">Manage Sync</Button.Text>
          </Button>
          <Button onPress={handlePressLogout} borderColor="$border">
            <Button.Text>Logout</Button.Text>
          </Button>
        </XStack>
      </YStack>
    </>
  );
}
