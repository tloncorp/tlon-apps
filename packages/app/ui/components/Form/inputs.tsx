import { VariantsFromValues, useIsWindowNarrow, useToast } from '@tloncorp/ui';
import { Button } from '@tloncorp/ui';
import { Icon, IconType } from '@tloncorp/ui';
import { Image } from '@tloncorp/ui';
import { Pressable } from '@tloncorp/ui';
import { Text } from '@tloncorp/ui';
import { desktopTypeStyles, mobileTypeStyles } from '@tloncorp/ui';
import { ImagePickerAsset } from 'expo-image-picker';
import {
  ComponentProps,
  ReactElement,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import React from 'react';
import { Alert, TextInput as RNTextInput } from 'react-native';
import {
  ScrollView,
  Spinner,
  View,
  ViewStyle,
  XStack,
  YStack,
  styled,
  withStaticProperties,
} from 'tamagui';

import {
  useAttachmentContext,
  useMappedImageAttachments,
} from '../../contexts';
import AttachmentSheet from '../AttachmentSheet';
import { ListItem } from '../ListItem';
import { useBoundHandler } from '../ListItem/listItemUtils';
import { FieldContext } from './Field';
import {
  Accent,
  getBorderVariantStyle as getBackgroundTypeVariantStyle,
} from './formUtils';

export const RawTextInput = styled(
  RNTextInput,
  {
    name: 'RawTextInput',
    ...mobileTypeStyles['$label/xl'],
    lineHeight: 'unset',
    context: FieldContext,
    color: '$primaryText',
    placeholderTextColor: '$tertiaryText',
    fontFamily: '$body',
    textAlignVertical: 'top',
    paddingVertical: '$l',
    numberOfLines: 1,
    '$platform-web': { outlineStyle: 'none' },
    $gtSm: desktopTypeStyles['$label/xl'],
    variants: {
      accent: {
        negative: {
          color: '$negativeActionText',
        },
        positive: {
          color: '$positiveActionText',
        },
      },
    } as const,
  },
  {
    isInput: true,
    accept: {
      placeholderTextColor: 'color',
      selectionColor: 'color',
    } as const,
  }
);

// Text input

export const InputFrame = styled(XStack, {
  name: 'InputFrame',
  context: FieldContext,
  paddingLeft: '$xl',
  paddingRight: '$l',
  gap: '$m',
  borderWidth: 1,
  borderRadius: '$l',
  backgroundColor: '$background',
  borderColor: '$border',
  overflow: 'hidden',
  alignItems: 'center',
  height: 56,
  variants: {
    accent: {
      negative: {
        backgroundColor: '$negativeBackground',
        borderColor: '$negativeBorder',
      },
      positive: {
        backgroundColor: '$positiveBackground',
        borderColor: '$positiveBorder',
      },
    },
    backgroundType: getBackgroundTypeVariantStyle,
  } as VariantsFromValues<{
    accent: Accent;
    backgroundType: 'primary' | 'secondary';
  }>,
});

export type TextInputRef = RNTextInput;

const TextInputComponent = RawTextInput.styleable<{
  icon?: IconType;
  accent?: Accent;
  backgroundType?: 'primary' | 'secondary';
  rightControls?: ReactNode;
  frameStyle?: ViewStyle;
}>(
  ({ icon, accent, backgroundType, frameStyle, ...props }, ref) => {
    const fieldContext = useContext(FieldContext);
    return (
      <InputFrame
        accent={accent ?? fieldContext.accent}
        {...(props.numberOfLines && props.numberOfLines !== 1
          ? { height: 'unset' }
          : {})}
        backgroundType={backgroundType ?? fieldContext.backgroundType}
        {...frameStyle}
      >
        {icon ? <Icon type={icon} size="$m" /> : null}
        <RawTextInput flex={1} ref={ref} {...props} />
        {props.rightControls}
      </InputFrame>
    );
  },
  { staticConfig: { memo: true } }
);

const InnerButton = ({
  label: buttonText,
  onPress: onPress,
  ...props
}: { label: string; onPress?: () => void } & ComponentProps<typeof View>) => {
  return (
    <View padding="$l" flexShrink={0} paddingRight={0} {...props}>
      <TextInputButton onPress={onPress}>
        <TextInputButtonText>{buttonText}</TextInputButtonText>
      </TextInputButton>
    </View>
  );
};

const TextInputButton = styled(Button, {
  context: FieldContext,
  backgroundColor: '$secondaryBackground',
  borderRadius: '$m',
  height: '$3xl',
  paddingHorizontal: '$l',
  variants: {
    accent: {
      negative: {
        backgroundColor: '$negativeBackground',
        borderColor: '$negativeBorder',
      },
      positive: {
        backgroundColor: '$positiveBackground',
        color: '$positiveActionText',
      },
    },
    backgroundType: getBackgroundTypeVariantStyle,
  } as const,
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
  const { canUpload } = useAttachmentContext();
  const isWindowNarrow = useIsWindowNarrow();
  const showToast = useToast();

  useEffect(() => {
    if (assetUri !== value) {
      onChange?.(assetUri);
    }
    // only want this to fire when the value changes, not the handler
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetUri]);

  const handleImageSelected = useCallback((assets: ImagePickerAsset[]) => {
    setAssetUri(assets[0].uri);
  }, []);

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
    } else if (attachment && attachment.uploadState?.status === 'error') {
      // Show toast with error message
      const errorMessage =
        attachment.uploadState.errorMessage || 'Upload failed';
      showToast({
        message: `Failed to upload image: ${errorMessage}`,
        duration: 5000,
      });
      // Clear the failed upload so user can try again
      setAssetUri(undefined);
    }
  }, [attachment, showToast]);

  const handleImageRemoved = useCallback(() => {
    setAssetUri(undefined);
  }, []);

  return (
    <>
      <XStack gap="$m" ref={ref}>
        <ImageInputButtonFrame group onPress={handleSheetToggled}>
          <ImageInputButtonText>{buttonLabel}</ImageInputButtonText>
        </ImageInputButtonFrame>
        <ImageInputPreviewFrame
          height={isWindowNarrow ? undefined : '100%'}
          onPress={handleSheetToggled}
        >
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
        onAttach={handleImageSelected}
        showClearOption={showClear && !!value}
        onClearAttachments={handleImageRemoved}
      />
    </>
  );
});

const ImageInputButtonFrame = styled(InputFrame, {
  context: FieldContext,
  justifyContent: 'center',
  padding: '$xl',
  flex: 1,
  pressStyle: { backgroundColor: '$border' },
});

const ImageInputButtonText = styled(Text, {
  size: '$label/xl',
  trimmed: false,
  color: '$secondaryText',
  lineHeight: '$s',
  '$group-press': { color: '$tertiaryText' },
});

const ImageInputPreviewFrame = styled(View, {
  borderRadius: '$l',
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
  objectFit: 'cover',
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

export const ToggleGroupInput = ({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string | React.ReactNode }[];
  value: string;
  onChange: (value: string) => void;
}) => {
  const { backgroundType } = useContext(FieldContext);
  const [defaultColor, selectedColor] =
    backgroundType === 'primary'
      ? ['$background', '$secondaryBackground']
      : ['$secondaryBackground', '$background'];

  return (
    <InputFrame>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
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
                value === tab.value ? selectedColor : defaultColor
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
    </InputFrame>
  );
};

const TextInputButtonText = styled(Text, {
  size: '$label/m',
});

export const TextInput = withStaticProperties(TextInputComponent, {
  InnerButton,
});

// Shared control style between radio and checkbox

const ControlFrame = styled(InputFrame, {
  width: '$3xl',
  height: '$3xl',
  borderWidth: 1,
  borderColor: '$border',
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
        backgroundColor: '$border',
      },
    },
    type: {
      radio: {
        borderRadius: 150,
      },
      checkbox: {
        borderRadius: '$s',
      },
    },
  } as const,
});

export const Control = ControlFrame.styleable<{
  checked?: boolean;
  type: 'radio' | 'checkbox';
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
          testID={`RadioInputRow-${option.title}`}
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
  cursor: 'pointer',
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
  props: Omit<ComponentProps<typeof Control>, 'type'>
) => <Control {...props} type="radio" />;

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
  props: Omit<ComponentProps<typeof Control>, 'type'>
) => <Control {...props} type="checkbox" />;
