import { requireNativeViewManager } from 'expo-modules-core';
import {
  type ComponentType,
  type ForwardRefExoticComponent,
  type RefAttributes,
  type RefObject,
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  type ColorValue,
  type DimensionValue,
  type LayoutChangeEvent,
  type TextInputInstance,
  type TextInputSelectionChangeEvent,
  type ViewProps,
  processColor,
} from 'react-native';
import { useTheme } from 'tamagui';

import type { PastedFile } from '../BareChatInput/pastedImage';
import type {
  NoteBodyMenuItem,
  NoteBodyTextAreaProps,
} from './NoteBodyTextArea.shared';

type NativeEvent<T> = { nativeEvent: T };
type NativeHandle = { focus: () => Promise<void> };

type NativeNoteBodyInputProps = ViewProps & {
  ref: RefObject<NativeHandle | null>;
  value: {
    text: string;
    eventCount: number;
    selectionStart?: number;
    selectionEnd?: number;
    selectionRequestId: number;
  };
  placeholder?: string;
  placeholderTextColor: ReturnType<typeof processColor>;
  textColor: ReturnType<typeof processColor>;
  fontSize: number;
  lineHeight: number;
  editable: boolean;
  menuItems: NoteBodyMenuItem[];
  acceptsImagePaste: boolean;
  onBodyChange: (
    event: NativeEvent<{ text: string; eventCount: number }>
  ) => void;
  onBodySelectionChange: (
    event: NativeEvent<{ start: number; end: number }>
  ) => void;
  onBodyFocus: () => void;
  onBodyBlur: () => void;
  onMenuItemPress: (event: NativeEvent<{ id: string }>) => void;
  onPasteImages: (
    event: NativeEvent<{ files: PastedFile[]; failedCount: number }>
  ) => void;
};

const NativeNoteBodyInput: ComponentType<NativeNoteBodyInputProps> =
  requireNativeViewManager<NativeNoteBodyInputProps>('TlonNoteBodyInput');

// The note body on iOS and Android is a native text view we own, so its
// long-press menu can carry the editor's own items and a pasted image reaches
// the upload path. It takes the web TextArea's props and uses the ones that
// apply on a phone, where the body never scrolls itself or carries padding.
export const NoteBodyTextArea: ForwardRefExoticComponent<
  NoteBodyTextAreaProps & RefAttributes<Pick<TextInputInstance, 'focus'>>
> = forwardRef<Pick<TextInputInstance, 'focus'>, NoteBodyTextAreaProps>(
  function NoteBodyTextArea(
    {
      value,
      onChangeText,
      onSelectionChange,
      onFocus,
      onBlur,
      onLayout,
      placeholder,
      placeholderTextColor,
      color,
      fontSize,
      style,
      disabled,
      width,
      minHeight,
      height,
      testID,
      onPasteFiles,
      onPasteFailed,
      menuItems,
      onMenuItemPress,
      caretRequest,
    },
    ref
  ) {
    const theme = useTheme();
    const nativeRef = useRef<NativeHandle>(null);
    // The latest native edit JS has seen; see NoteBodyValue in the module.
    const [eventCount, setEventCount] = useState(0);

    useImperativeHandle(
      ref,
      () => ({
        focus: () => {
          void nativeRef.current?.focus();
        },
      }),
      []
    );

    const resolveColor = (token: unknown) => {
      const name =
        typeof token === 'string' && token.startsWith('$')
          ? token.slice(1)
          : null;
      const resolved = name
        ? (theme as Record<string, { val?: unknown } | undefined>)[name]?.val
        : token;
      return processColor(resolved as ColorValue);
    };

    const nativeValue = useMemo(
      () => ({
        text: String(value ?? ''),
        eventCount,
        selectionStart: caretRequest?.caret,
        selectionEnd: caretRequest?.caret,
        selectionRequestId: caretRequest?.id ?? 0,
      }),
      [caretRequest, eventCount, value]
    );

    return (
      <NativeNoteBodyInput
        ref={nativeRef}
        testID={testID}
        style={{
          width: width as DimensionValue,
          minHeight: minHeight as DimensionValue,
          height: height as DimensionValue,
        }}
        onLayout={(event: LayoutChangeEvent) => onLayout?.(event as never)}
        value={nativeValue}
        placeholder={placeholder}
        placeholderTextColor={resolveColor(placeholderTextColor)}
        textColor={resolveColor(color)}
        fontSize={Number(fontSize)}
        lineHeight={(style as { lineHeight?: number })?.lineHeight ?? 0}
        editable={!disabled}
        menuItems={menuItems ?? []}
        acceptsImagePaste={onPasteFiles != null}
        onBodyChange={(event) => {
          setEventCount(event.nativeEvent.eventCount);
          onChangeText?.(event.nativeEvent.text);
        }}
        onBodySelectionChange={(event) => {
          onSelectionChange?.({
            nativeEvent: { selection: event.nativeEvent },
          } as TextInputSelectionChangeEvent);
        }}
        // The notes screen's focus and blur handlers ignore the event.
        onBodyFocus={() => onFocus?.(undefined as never)}
        onBodyBlur={() => onBlur?.(undefined as never)}
        onMenuItemPress={(event) => onMenuItemPress?.(event.nativeEvent.id)}
        onPasteImages={(event) => {
          const { files, failedCount } = event.nativeEvent;
          if (files.length > 0) {
            onPasteFiles?.(files);
          }
          if (failedCount > 0) {
            onPasteFailed?.();
          }
        }}
      />
    );
  }
);
