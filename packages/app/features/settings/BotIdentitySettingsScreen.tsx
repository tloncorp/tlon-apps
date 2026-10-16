import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useRef, useState } from 'react';

import { RootStackParamList } from '../../navigation/types';
import { SettingsListScreenView } from '../../ui/components/SettingsList';
import {
  BotSettingsApplyBar,
  useBotSettingsHub,
} from './bot/BotSettingsSections';

type Props = NativeStackScreenProps<RootStackParamList, 'BotIdentitySettings'>;

export function BotIdentitySettingsScreen(props: Props) {
  const hub = useBotSettingsHub();
  const { queries, settingsReady, draft, pending, commitDraft, applying } = hub;
  const loading = queries.nicknameQuery.isLoading;

  const handleBack = useCallback(() => {
    props.navigation.goBack();
  }, [props.navigation]);

  const nickname = useNicknameEditor({
    nickname: draft.nickname,
    pending: pending.nickname,
    onCommit: (value) =>
      commitDraft((current) => ({ ...current, nickname: value })),
  });

  return (
    <SettingsListScreenView
      title="Identity"
      sections={[
        {
          key: 'nickname',
          title: `Nickname${pending.nickname ? ' (pending)' : ''}`,
          footer:
            nickname.error ??
            "This is your bot's name. Your own profile name is set under Your profile.",
          rows: [
            {
              key: 'nickname',
              title: 'Nickname',
              disabled: loading || !settingsReady || applying,
              textField: {
                value: nickname.value,
                onChangeText: nickname.setValue,
                placeholder: loading ? 'Loading…' : 'tlonbot',
                capitalization: 'words',
                onFocusChange: nickname.onFocusChange,
                onSubmit: nickname.commit,
              },
            },
          ],
        },
      ]}
      onBackPressed={handleBack}
      bottomBar={<BotSettingsApplyBar hub={hub} />}
    />
  );
}

/**
 * Edits the nickname locally and commits it to the draft when editing ends,
 * on blur or Done.
 */
function useNicknameEditor({
  nickname,
  pending,
  onCommit,
}: {
  nickname: string;
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

  const onFocusChange = useCallback(
    (focused: boolean) => {
      if (focused) {
        isEditingRef.current = true;
      } else {
        commit();
      }
    },
    [commit]
  );

  return { value, setValue, error, commit, onFocusChange };
}
