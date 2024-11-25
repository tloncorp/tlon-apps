import { ImagePickerAsset } from 'expo-image-picker';
import React, {
  ComponentProps,
  ReactElement,
  useCallback,
  useEffect,
  useState,
} from 'react';
import { Alert, TextInput as RNTextInput } from 'react-native';
import { ScrollView, Spinner, View, XStack, YStack, styled } from 'tamagui';
import { isWeb } from 'tamagui';

import {
  useAttachmentContext,
  useMappedImageAttachments,
} from '../../contexts';
import AttachmentSheet from '../AttachmentSheet';
import { Button } from '../Button';
import { Icon, IconType } from '../Icon';
import { Image } from '../Image';
import { ListItem } from '../ListItem';
import { useBoundHandler } from '../ListItem/listItemUtils';
import Pressable from '../Pressable';
import { Text } from '../TextV2';
import { FieldContext } from './Form';

const StyledTextInput = styled(
  RNTextInput,
  {},
  {
    isInput: true,
    accept: {
      placeholderTextColor: 'color',
      selectionColor: 'color',
    } as const,
  }
);

// Text input

export const BaseTextInput = styled(StyledTextInput, {
  context: FieldContext,
  color: '$primaryText',
  borderRadius: '$l',
  borderWidth: 1,
  borderColor: '$border',
  backgroundColor: '$background',
  placeholderTextColor: '$tertiaryText',
  fontSize: '$l',
  padding: '$xl',
  fontFamily: '$body',
  textAlignVertical: 'top',
  variants: {
    accent: {
      negative: {
        backgroundColor: '$negativeBackground',
        color: '$negativeActionText',
        borderColor: '$negativeBorder',
      },
    },
  },
  ...(isWeb ? { outlineStyle: 'none' } : {}),
});

export const TextInput = React.memo(BaseTextInput);

export const TextInputWithIcon = React.memo(
  BaseTextInput.styleable<{ icon: IconType }>(({ icon, ...props }, ref) => {
    return (
      <XStack
        borderRadius="$l"
        borderWidth={1}
        borderColor="$border"
        alignItems="center"
        paddingLeft="$xl"
        gap="$l"
      >
        <Icon type={icon} customSize={['$2xl', '$2xl']} />
        <BaseTextInput
          paddingLeft={0}
          borderWidth={0}
          borderRadius={0}
          flex={1}
          ref={ref}
          {...props}
        />
      </XStack>
    );
  })
);

interface TextInputWithButtonProps extends ComponentProps<typeof TextInput> {
  buttonText: string;
  onButtonPress: () => void;
}

const TextInputWithButtonFrame = styled(XStack, {
  context: FieldContext,
  borderWidth: 1,
  borderColor: '$border',
  borderRadius: '$l',
  backgroundColor: '$background',
  variants: {
    accent: {
      negative: {
        backgroundColor: '$negativeBackground',
        color: '$negativeActionText',
        borderColor: '$negativeBorder',
      },
    },
  } as const,
});

const TextInputButton = styled(Button, {
  context: FieldContext,
  backgroundColor: '$secondaryBackground',
  padding: '$l',
  borderRadius: '$m',
  variants: {
    accent: {
      negative: {
        backgroundColor: '$negativeBackground',
        color: '$negativeActionText',
        borderColor: '$negativeBorder',
      },
    },
  } as const,
});

// Needs polish, I know we just talked about Ochre conformance plz forgive
export const TextInputWithButton: React.FC<TextInputWithButtonProps> =
  React.memo(function TextInputWithButtonRaw({
    buttonText,
    onButtonPress,
    ...textInputProps
  }) {
    return (
      <TextInputWithButtonFrame>
        <TextInput
          flex={1}
          borderWidth={0}
          textAlignVertical="unset"
          {...textInputProps}
        />
        <View padding="$l">
          <TextInputButton onPress={onButtonPress}>
            <Button.Text>{buttonText}</Button.Text>
          </TextInputButton>
        </View>
      </TextInputWithButtonFrame>
    );
  });

export const ImageInput = XStack.styleable<{
  buttonLabel?: string;
  value?: string;
  placeholderUri?: string;
  onChange?: (value?: string) => void;
  showClear?: boolean;
}>(function ImageInput(
  { buttonLabel, value, showClear = true, placeholderUri, onChange },
  ref
) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [assetUri, setAssetUri] = useState<string | undefined>(
    value ?? undefined
  );
  const { attachAssets, canUpload } = useAttachmentContext();

  useEffect(() => {
    if (assetUri !== value) {
      onChange?.(assetUri);
    }
    // only want this to fire when the value changes, not the handler
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetUri]);

  const handleImageSelected = useCallback(
    (assets: ImagePickerAsset[]) => {
      attachAssets([assets[0]]);
      setAssetUri(assets[0].uri);
    },
    [attachAssets]
  );

  const handleSheetToggled = useCallback(() => {
    if (!canUpload) {
      Alert.alert('Configure storage to upload images');
    }
    setSheetOpen((open) => !open);
  }, [canUpload]);

  const { attachment } = useMappedImageAttachments(
    assetUri ? { attachment: assetUri } : {}
  );

  useEffect(() => {
    if (attachment && attachment.uploadState?.status === 'success') {
      setAssetUri?.(attachment.uploadState.remoteUri);
    }
  }, [attachment]);

  const handleImageRemoved = useCallback(() => {
    setAssetUri(undefined);
  }, []);

  return (
    <>
      <XStack gap="$m" ref={ref}>
        <ImageInputButtonFrame group onPress={handleSheetToggled}>
          <ImageInputButtonText>{buttonLabel}</ImageInputButtonText>
        </ImageInputButtonFrame>
        <ImageInputPreviewFrame onPress={handleSheetToggled}>
          <Icon type="Camera" color="$tertiaryText" />
          {placeholderUri ? (
            <ImageInputPreviewImage source={{ uri: placeholderUri }} />
          ) : null}
          {assetUri ? (
            <ImageInputPreviewImage source={{ uri: assetUri }} />
          ) : null}
          {attachment?.uploadState?.status === 'uploading' ? (
            <ImageInputPreviewLoadingFrame>
              <Spinner size="small" />
            </ImageInputPreviewLoadingFrame>
          ) : null}
        </ImageInputPreviewFrame>
      </XStack>
      <AttachmentSheet
        isOpen={sheetOpen}
        onOpenChange={setSheetOpen}
        onAttachmentsSet={handleImageSelected}
        showClearOption={showClear && !!value}
        onClearAttachments={handleImageRemoved}
      />
    </>
  );
});

const ImageInputButtonFrame = styled(XStack, {
  context: FieldContext,
  borderRadius: '$l',
  overflow: 'hidden',
  justifyContent: 'center',
  borderWidth: 1,
  borderColor: '$border',
  backgroundColor: '$background',
  padding: '$xl',
  flex: 1,
  pressStyle: { backgroundColor: '$border' },
  variants: {
    empty: {},
    accent: {
      negative: {
        backgroundColor: '$negativeBackground',
        color: '$negativeActionText',
        borderColor: '$negativeBorder',
      },
    },
  },
});

const ImageInputButtonText = styled(Text, {
  size: '$label/xl',
  trimmed: false,
  color: '$secondaryText',
  lineHeight: '$s',
  '$group-press': { color: '$tertiaryText' },
});

const ImageInputPreviewFrame = styled(View, {
  borderRadius: '$m',
  aspectRatio: 1,
  overflow: 'hidden',
  backgroundColor: '$border',
  alignItems: 'center',
  justifyContent: 'center',
  pressStyle: { opacity: 0.5 },
});

const ImageInputPreviewImage = styled(Image, {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
});

const ImageInputPreviewLoadingFrame = styled(View, {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  backgroundColor: 'rgba(0,0,0,.25)',
  alignItems: 'center',
  justifyContent: 'center',
});

interface TextInputWithIconAndButtonProps
  extends ComponentProps<typeof TextInput> {
  icon: IconType;
  buttonText: string;
  onButtonPress: () => void;
}

export const TextInputWithIconAndButton = React.memo(
  function TextInputWithIconAndButtonRaw({
    icon,
    buttonText,
    onButtonPress,
    ...textInputProps
  }: TextInputWithIconAndButtonProps) {
    return (
      <XStack
        borderWidth={1}
        borderColor="$border"
        borderRadius="$l"
        paddingHorizontal="$xl"
        alignItems="center"
        gap="$l"
      >
        <Icon type={icon} customSize={['$2xl', '$2xl']} />
        <TextInput
          paddingLeft={0}
          borderWidth={0}
          borderRadius={0}
          flex={1}
          {...textInputProps}
        />
        <Button
          padding="$l"
          onPress={onButtonPress}
          backgroundColor="$secondaryBackground"
          marginRight="$-m"
        >
          <Button.Text size="$label/m">{buttonText}</Button.Text>
        </Button>
      </XStack>
    );
  }
);

// Toggle group

export const ToggleGroupInput = ({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string | React.ReactNode }[];
  value: string;
  onChange: (value: string) => void;
}) => {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      borderWidth={1}
      borderColor="$border"
      borderRadius="$l"
      contentContainerStyle={{
        flexGrow: 1,
      }}
    >
      <XStack minWidth="100%">
        {options.map((tab, index) => (
          <Button
            flex={1}
            minWidth={75}
            key={tab.value}
            onPress={() => onChange(tab.value)}
            padding="$xl"
            borderWidth={0}
            borderRadius={0}
            borderRightWidth={index !== options.length - 1 ? 1 : 0}
            backgroundColor={
              value === tab.value ? '$secondaryBackground' : 'unset'
            }
          >
            {typeof tab.label === 'string' ? (
              <Button.Text size="$l">{tab.label}</Button.Text>
            ) : (
              tab.label
            )}
          </Button>
        ))}
      </XStack>
    </ScrollView>
  );
};

// Shared control style between radio and checkbox

const ControlFrame = styled(View, {
  width: '$3xl',
  height: '$3xl',
  borderWidth: 1,
  borderColor: '$shadow',
  alignItems: 'center',
  justifyContent: 'center',
  variants: {
    checked: {
      true: {
        backgroundColor: '$positiveActionText',
        borderColor: '$positiveActionText',
      },
    },
    disabled: {
      true: {
        backgroundColor: '$shadow',
      },
    },
    variant: {
      radio: {
        borderRadius: 100,
      },
      checkbox: {
        borderRadius: '$s',
      },
    },
  } as const,
});

export const Control = ControlFrame.styleable<{
  checked?: boolean;
  variant: 'radio' | 'checkbox';
}>((props, ref) => {
  return (
    <ControlFrame {...props} ref={ref}>
      {props.checked ? <Icon color="$background" type="Checkmark" /> : null}
    </ControlFrame>
  );
});

// Radio input

export type RadioInputOption<T> = {
  title: string;
  value: T;
  description?: string;
  disabled?: boolean;
};

export const RadioInput = <T,>({
  options,
  onChange,
  value,
  ...props
}: {
  options: {
    title: string;
    value: T;
    description?: string;
    disabled?: boolean;
  }[];
  value?: T;
  onChange?: (value: T) => void;
} & ComponentProps<typeof YStack>) => {
  return (
    <YStack {...props}>
      {options.map((option) => (
        <RadioInputRow
          key={option.title}
          option={option}
          onPress={onChange}
          checked={value === option.value}
        />
      ))}
    </YStack>
  );
};

const RadioInputRowFrame = styled(XStack, {
  gap: '$xl',
  paddingHorizontal: '$xl',
  paddingVertical: '$l',
  alignItems: 'center',
  borderRadius: '$l',
  variants: {
    disabled: {
      false: {
        pressStyle: {
          backgroundColor: '$secondaryBackground',
        },
      },
    },
  },
  defaultVariants: {
    disabled: false,
  },
});

/**
 * Single option row
 */
export function RadioInputRow<T>({
  option,
  onPress,
  checked,
}: {
  option: RadioInputOption<T>;
  onPress?: (value: T) => void;
  checked?: boolean;
} & Omit<ComponentProps<typeof RadioInputRowFrame>, 'onPress'>) {
  const handlePress = useBoundHandler(option.value, onPress);
  return (
    <RadioInputRowFrame
      onPress={option.disabled ? undefined : handlePress}
      disabled={!!option.disabled}
    >
      <RadioControl
        key={option.title}
        disabled={option.disabled}
        checked={checked}
      />
      <YStack gap="$l">
        <Text size="$label/xl" color="$primaryText">
          {option.title}
        </Text>
        {option.description ? (
          <Text size="$label/m" color="$secondaryText">
            {option.description}
          </Text>
        ) : null}
      </YStack>
    </RadioInputRowFrame>
  );
}

/**
 * The actual little checkmark button
 */
export const RadioControl = (
  props: Omit<ComponentProps<typeof Control>, 'variant'>
) => <Control {...props} variant="radio" />;

// List item input

export type ListItemInputOption<T> = {
  title: string;
  subtitle?: string;
  icon?: IconType | ReactElement;
  value: T;
  disabled?: boolean;
};

/**
 * Like RadioInput, but renders pickable list items
 */
export const ListItemInput = <T,>({
  options,
  onChange,
  value,
  ...props
}: {
  options: ListItemInputOption<T>[];
  value?: T;
  onChange?: (value: T) => void;
} & ComponentProps<typeof YStack>) => {
  return (
    <YStack {...props}>
      {options.map((option) => (
        <ListItemInputRow
          key={option.title}
          option={option}
          onPress={onChange}
          checked={value === option.value}
        />
      ))}
    </YStack>
  );
};

function ListItemInputRow<T>({
  option,
  onPress,
  checked,
}: {
  option: ListItemInputOption<T>;
  onPress?: (value: T) => void;
  checked?: boolean;
}) {
  const handlePress = useBoundHandler(option.value, onPress);
  return (
    <Pressable borderRadius="$xl" onPress={handlePress}>
      <ListItem>
        {option.icon ? (
          typeof option.icon === 'string' ? (
            <ListItem.SystemIcon icon={option.icon} />
          ) : (
            option.icon
          )
        ) : null}
        <ListItem.MainContent>
          <ListItem.Title>{option.title}</ListItem.Title>
          {option.subtitle ? (
            <ListItem.Subtitle>{option.subtitle}</ListItem.Subtitle>
          ) : null}
        </ListItem.MainContent>
        <ListItem.EndContent padding={0}>
          {checked ? <RadioControl checked /> : null}
        </ListItem.EndContent>
      </ListItem>
    </Pressable>
  );
}

/* A checkbox input that can be used to select multiple options */

export type CheckboxInputOption<T> = {
  title: string;
  value: T;
  description?: string;
  disabled?: boolean;
};

export const CheckboxInput = <T,>({
  option,
  onChange,
  checked,
  ...props
}: {
  option: CheckboxInputOption<T>;
  checked?: boolean;
  onChange?: (value: T) => void;
} & ComponentProps<typeof YStack>) => {
  return (
    <YStack {...props}>
      <CheckboxInputRow
        key={option.title}
        option={option}
        onPress={onChange}
        checked={checked}
      />
    </YStack>
  );
};

export function CheckboxInputRow<T>({
  option,
  onPress,
  checked,
}: {
  option: CheckboxInputOption<T>;
  onPress?: (value: T) => void;
  checked?: boolean;
} & Omit<ComponentProps<typeof RadioInputRowFrame>, 'onPress'>) {
  const handlePress = useBoundHandler(option.value, onPress);
  return (
    <RadioInputRowFrame
      onPress={option.disabled ? undefined : handlePress}
      disabled={!!option.disabled}
    >
      <CheckboxControl
        key={option.title}
        disabled={option.disabled}
        checked={checked}
      />
      <YStack gap="$l">
        <Text size="$label/l" color="$primaryText">
          {option.title}
        </Text>
        {option.description ? (
          <Text size="$label/m" color="$secondaryText">
            {option.description}
          </Text>
        ) : null}
      </YStack>
    </RadioInputRowFrame>
  );
}

export const CheckboxControl = (
  props: Omit<ComponentProps<typeof Control>, 'variant'>
) => <Control {...props} variant="checkbox" />;
