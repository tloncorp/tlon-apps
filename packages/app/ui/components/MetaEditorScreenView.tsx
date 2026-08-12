import * as db from '@tloncorp/shared/db';
import * as logic from '@tloncorp/shared/logic';
import { KeyboardAvoidingView, useIsWindowNarrow } from '@tloncorp/ui';
import {
  PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useForm } from 'react-hook-form';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Popover, ScrollView, View } from 'tamagui';

import { useShipConnectionStatus } from '../../features/top/useShipConnectionStatus';
import { capitalize } from '../utils';
import ConnectionStatus from './ConnectionStatus';
import {
  ControlledImageField,
  ControlledTextField,
  ControlledTextareaField,
  FormFrame,
} from './Form';
import { ScreenHeader } from './ScreenHeader';
import WayfindingNotice from './Wayfinding/Notices';

export function MetaEditorScreenView({
  title,
  goBack,
  children,
  onSubmit,
  chat,
  currentUserId,
}: PropsWithChildren<{
  title: string;
  onSubmit: (meta: db.ClientMeta, originalMeta: db.ClientMeta) => void;
  goBack: () => void;
  chat?: db.Group | db.Channel | null;
  currentUserId: string;
}>) {
  const [modelLoaded, setModelLoaded] = useState(!!chat);
  const defaultValues = useMemo(() => getMetaWithDefaults(chat), [chat]);
  const originalValues = useRef(defaultValues);
  const isGroup = !!chat && logic.isGroup(chat);
  const hostStatus = useShipConnectionStatus(isGroup ? chat.hostUserId : '', {
    enabled: isGroup,
  });

  const label = isGroup ? 'group' : 'channel';

  const isPersonalGroup = useMemo(() => {
    if (isGroup) {
      return logic.isPersonalGroup(chat, currentUserId);
    }
  }, [chat, currentUserId, isGroup]);

  const {
    control,
    handleSubmit,
    formState: { isValid },
    reset,
  } = useForm({
    defaultValues,
  });

  const disabled =
    !isValid ||
    (isGroup && (!hostStatus.complete || hostStatus.status !== 'yes'));

  useEffect(() => {
    if (!modelLoaded && chat) {
      setModelLoaded(true);
      originalValues.current = defaultValues;
      reset(defaultValues);
    }
  }, [chat, modelLoaded, reset, defaultValues]);

  const runSubmit = useCallback(
    () => handleSubmit((data) => onSubmit(data, originalValues.current))(),
    [handleSubmit, onSubmit]
  );

  const insets = useSafeAreaInsets();

  const isWindowNarrow = useIsWindowNarrow();

  return (
    <View flex={1} backgroundColor={'$secondaryBackground'}>
      <ScreenHeader
        title={title}
        backgroundColor="$secondaryBackground"
        backAction={goBack}
        useHorizontalTitleLayout={!isWindowNarrow}
        rightControls={
          <ScreenHeader.TextButton
            onPress={runSubmit}
            color="$positiveActionText"
            disabled={disabled}
          >
            Save
          </ScreenHeader.TextButton>
        }
      />
      <KeyboardAvoidingView style={{ flex: 1 }}>
        <ScrollView
          keyboardDismissMode="on-drag"
          contentContainerStyle={{
            minHeight: '100%',
            paddingBottom: insets.bottom,
          }}
        >
          {isPersonalGroup && <WayfindingNotice.CustomizeGroup />}
          <FormFrame paddingBottom={'$2xl'} flex={1} backgroundType="secondary">
            <ControlledTextField
              name="title"
              label="Name"
              control={control}
              inputProps={{
                placeholder: capitalize(label) + ' name',
                testID: 'GroupTitleInput',
              }}
              rules={{
                maxLength: {
                  value: 30,
                  message: `Your ${label} name is limited to 30 characters`,
                },
              }}
            />
            <ControlledImageField
              label="Icon image"
              name="iconImage"
              hideError={true}
              control={control}
              inputProps={{
                buttonLabel: 'Change icon image',
              }}
              rules={{
                pattern: {
                  value: /^(?!file|data).+/,
                  message: 'Image has not finished uploading',
                },
              }}
            />
            {/* FIXME(group-description-hijack): group.description is currently
                the storage for the machine-readable agent config (see
                parseGroupAgentConfig in @tloncorp/api) — the field is NOT
                reliable user prose, so it is hidden everywhere in the UI. The
                Description textarea is hidden for groups along with the
                displays: an edit could only land in the config's purpose
                field, invisibly. Restore it once the config moves to a
                first-class field on the group record. Channel descriptions
                are ordinary prose and stay editable. */}
            {!isGroup && (
              <ControlledTextareaField
                name="description"
                label={`Description`}
                control={control}
                inputProps={{
                  placeholder: `About this ${label}`,
                  numberOfLines: 5,
                  testID: 'GroupDescriptionInput',
                  multiline: true,
                }}
                rules={{
                  maxLength: {
                    value: 300,
                    message: 'Description is limited to 300 characters',
                  },
                }}
              />
            )}
            {children}
          </FormFrame>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

export function getMetaWithDefaults(
  chat: db.Group | db.Channel | null | undefined,
  defaults = {
    title: '',
    description: '',
    coverImage: '',
    iconImage: '',
  }
) {
  return {
    title: chat?.title || defaults.title,
    // FIXME(group-description-hijack): a group's raw description may be its
    // agent-config JSON. The description field isn't rendered for groups, so
    // the untouched default is what gets submitted — pass the raw value
    // through verbatim so a group meta save round-trips the config exactly
    // (the store also preserves a config-bearing description outright as a
    // second line of defense). Channels are ordinary prose.
    description: chat?.description || defaults.description,
    coverImage: chat?.coverImage || defaults.coverImage,
    iconImage: chat?.iconImage || defaults.iconImage,
  };
}
