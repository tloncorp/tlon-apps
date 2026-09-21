import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Text, useIsWindowNarrow } from '@tloncorp/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View, YStack } from 'tamagui';

import { RootStackParamList } from '../../navigation/types';
import { ScreenHeader, SettingsContentScrollView, TextInput } from '../../ui';
import {
  BotSettingsApplyBar,
  useBotSettingsHub,
} from './bot/BotSettingsSections';
import { BotSettingsSection } from './bot/BotSettingsUI';

type Props = NativeStackScreenProps<RootStackParamList, 'BotIdentitySettings'>;

export function BotIdentitySettingsScreen(props: Props) {
  const isWindowNarrow = useIsWindowNarrow();
  const hub = useBotSettingsHub();
  const { queries, settingsReady, draft, pending, commitDraft, applying } = hub;

  const handleBack = useCallback(() => {
    props.navigation.goBack();
  }, [props.navigation]);

  return (
    <View flex={1} backgroundColor="$secondaryBackground">
      <ScreenHeader
        borderBottom
        backAction={isWindowNarrow ? handleBack : undefined}
        title="Identity"
        placement="navigation"
      />
      <SettingsContentScrollView
        paddingHorizontal="$l"
        paddingTop="$l"
        safeAreaBottomOffset={24}
      >
        <BotSettingsSection description="This is your bot's name. Your own profile name is set under Your profile.">
          <NicknameField
            nickname={draft.nickname}
            loading={queries.nicknameQuery.isLoading}
            readOnly={!settingsReady || applying}
            pending={pending.nickname}
            onCommit={(value) =>
              commitDraft((current) => ({ ...current, nickname: value }))
            }
          />
        </BotSettingsSection>
      </SettingsContentScrollView>
      <BotSettingsApplyBar hub={hub} />
    </View>
  );
}

function NicknameField({
  nickname,
  loading,
  readOnly,
  pending,
  onCommit,
}: {
  nickname: string;
  loading: boolean;
  readOnly: boolean;
  pending: boolean;
  onCommit: (nickname: string) => void;
}) {
  const [value, setValue] = useState(nickname);
  const [error, setError] = useState<string | null>(null);
  const isEditingRef = useRef(false);
  const prevPendingRef = useRef(pending);

  // Adopt external changes to the nickname. Normally we skip this while the user
  // is typing so a background refetch can't wipe in-progress input — but when a
  // pending edit is cleared (Discard/Apply), adopt it even if the field is still
  // focused, and end the edit session. Otherwise a discarded edit would linger
  // in the input and get re-committed on the next blur.
  useEffect(() => {
    const pendingCleared = prevPendingRef.current && !pending;
    prevPendingRef.current = pending;
    if (!isEditingRef.current || pendingCleared) {
      isEditingRef.current = false;
      setValue(nickname);
    }
  }, [nickname, pending]);

  const commit = useCallback(() => {
    isEditingRef.current = false;
    const trimmed = value.trim();
    if (trimmed.length >= 64) {
      setError('Nickname must be fewer than 64 characters.');
      return;
    }
    setError(null);
    onCommit(trimmed);
  }, [value, onCommit]);

  return (
    <YStack padding="$l" gap="$m">
      <Text size="$label/m" color="$tertiaryText">
        Nickname{pending ? ' (pending)' : ''}
      </Text>
      <TextInput
        value={value}
        placeholder={loading ? 'Loading…' : 'tlonbot'}
        editable={!loading && !readOnly}
        onFocus={() => {
          isEditingRef.current = true;
        }}
        onChangeText={setValue}
        onBlur={commit}
        onSubmitEditing={commit}
        returnKeyType="done"
      />
      {error ? (
        <Text size="$label/s" color="$negativeActionText">
          {error}
        </Text>
      ) : null}
    </YStack>
  );
}
