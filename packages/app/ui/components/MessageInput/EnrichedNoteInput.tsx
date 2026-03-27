import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { NativeSyntheticEvent, TextStyle, ViewStyle } from 'react-native';
import {
  EnrichedTextInput,
  type EnrichedTextInputInstance,
  type OnChangeSelectionEvent,
  type OnChangeStateEvent,
  type OnPasteImagesEvent,
} from 'react-native-enriched';
import { useTheme } from 'tamagui';

import { useIsDarkTheme } from '../../utils';
import type { TlonBridgeState, TlonEditorBridge } from './toolbarActions';

/**
 * Subset of TlonEditorBridge that EnrichedNoteInput can fulfill via
 * the react-native-enriched imperative ref.
 */
export interface EnrichedNoteInputRef {
  editor: TlonEditorBridge | null;
}

export interface PastedImage {
  uri: string;
  type: string;
  width: number;
  height: number;
}

export interface EnrichedNoteInputProps {
  /** Called with HTML content on every change */
  onChangeHtml?: (html: string) => void;
  /** Called with reactive TlonBridgeState whenever editor state changes */
  onEditorStateChange?: (state: TlonBridgeState) => void;
  /** Called when images are pasted from the clipboard */
  onPasteImages?: (images: PastedImage[]) => void;
  /** Called when user starts typing a mention (e.g. types @) */
  onStartMention?: (indicator: string) => void;
  /** Called as user types mention search text */
  onChangeMention?: (indicator: string, text: string) => void;
  /** Called when mention mode ends (user left the trigger context) */
  onEndMention?: (indicator: string) => void;
  /** Initial HTML content to set when mounting */
  initialHtml?: string;
  placeholder?: string;
  testID?: string;
  style?: ViewStyle | TextStyle;
}

/** Map an OnChangeStateEvent + selection to a TlonBridgeState. */
function mapToTlonBridgeState(
  s: OnChangeStateEvent | null,
  sel?: { start: number; end: number }
): TlonBridgeState {
  const isLinkActive = s?.link?.isActive ?? false;
  const hasSelection = sel ? sel.start !== sel.end : false;
  return {
    isBoldActive: s?.bold?.isActive ?? false,
    isItalicActive: s?.italic?.isActive ?? false,
    isStrikeActive: s?.strikeThrough?.isActive ?? false,
    isCodeActive: s?.inlineCode?.isActive ?? false,
    isCodeBlockActive: s?.codeBlock?.isActive ?? false,
    isBlockquoteActive: s?.blockQuote?.isActive ?? false,
    isOrderedListActive: s?.orderedList?.isActive ?? false,
    isBulletListActive: s?.unorderedList?.isActive ?? false,
    isTaskListActive: s?.checkboxList?.isActive ?? false,
    isLinkActive,
    isUnderlineActive: s?.underline?.isActive ?? false,
    headingLevel:
      [1, 2, 3, 4, 5, 6].find((l) => (s as any)?.[`h${l}`]?.isActive) ?? 0,

    canToggleBold: true,
    canToggleItalic: true,
    canToggleStrike: true,
    canToggleCode: true,
    canToggleCodeBlock: true,
    canToggleBlockquote: true,
    canToggleOrderedList: true,
    canToggleBulletList: true,
    canToggleTaskList: true,
    canToggleHeading: true,
    canSetLink: hasSelection || isLinkActive,
    canUndo: false,
    canRedo: false,
    canSink: false,
    canLift: false,
    selection: { from: sel?.start ?? 0, to: sel?.end ?? 0 },
  } as TlonBridgeState;
}

/**
 * Thin wrapper around Software Mansion's `EnrichedTextInput` that exposes
 * a TlonEditorBridge-compatible adapter so BigInput's InputToolbar works.
 *
 * Content strategy:
 * - `onChangeHtml` emits HTML on every change for the send/draft path
 * - BigInput converts HTML↔Story via htmlToStory/storyToHtml
 * - `initialHtml` sets initial content when editing existing posts
 */
export const EnrichedNoteInput = memo(
  forwardRef<EnrichedNoteInputRef, EnrichedNoteInputProps>(
    (
      {
        onChangeHtml,
        onEditorStateChange,
        onPasteImages,
        onStartMention,
        onChangeMention,
        onEndMention,
        initialHtml,
        placeholder,
        testID,
        style,
      },
      ref
    ) => {
      const enrichedRef = useRef<EnrichedTextInputInstance>(null);
      const tamagui = useTheme();
      const isDark = useIsDarkTheme();

      // Build theme-aware htmlStyle to match the TipTap editor appearance
      const htmlStyle = useMemo(() => {
        const textColor = tamagui.primaryText.val;
        const secondaryText = tamagui.secondaryText.val;
        const borderColor = tamagui.border.val;
        // Subtle backgrounds that work in both light and dark mode
        const codeBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(97,97,97,0.1)';
        const codeColor = isDark ? '#c9d1d9' : '#616161';

        return {
          h1: { fontSize: 24, bold: true },
          h2: { fontSize: 20, bold: true },
          h3: { fontSize: 16, bold: true },
          h4: { fontSize: 14, bold: true },
          h5: { fontSize: 12, bold: true },
          h6: { fontSize: 10, bold: true },
          blockquote: {
            borderColor,
            borderWidth: 3,
            gapWidth: 12,
            color: secondaryText,
          },
          codeblock: {
            color: codeColor,
            borderRadius: 4,
            backgroundColor: codeBg,
          },
          code: {
            color: codeColor,
            backgroundColor: codeBg,
          },
          ul: {
            bulletColor: textColor,
            bulletSize: 6,
            marginLeft: 24,
            gapWidth: 8,
          },
          ol: {
            marginLeft: 24,
            gapWidth: 8,
            markerColor: textColor,
          },
          ulCheckbox: {
            boxSize: 18,
            gapWidth: 8,
            marginLeft: 16,
            boxColor: textColor,
          },
          a: {
            color: '#3b80e8',
            textDecorationLine: 'underline' as const,
          },
          mention: {
            color: '#3b80e8',
            backgroundColor: isDark
              ? 'rgba(59,128,232,0.15)'
              : 'rgba(59,128,232,0.1)',
          },
        };
      }, [
        tamagui.primaryText.val,
        tamagui.secondaryText.val,
        tamagui.border.val,
        isDark,
      ]);

      // Track active style state from onChangeState for the toolbar adapter
      const [styleState, setStyleState] = useState<OnChangeStateEvent | null>(
        null
      );
      // Track current selection for link operations
      const selectionRef = useRef<{ start: number; end: number; text: string }>(
        {
          start: 0,
          end: 0,
          text: '',
        }
      );

      // onChangeHtml gives NativeSyntheticEvent — unwrap and forward
      const handleChangeHtml = useCallback(
        (e: NativeSyntheticEvent<{ value: string }>) => {
          console.log('[EnrichedNoteInput] onChangeHtml:', e.nativeEvent.value);
          onChangeHtml?.(e.nativeEvent.value);
        },
        [onChangeHtml]
      );

      // Text shortcuts — all handled natively via textShortcuts prop.
      // Block shortcuts trigger at the start of a paragraph.
      // Inline shortcuts trigger when a closing delimiter wraps text.
      const nativeTextShortcuts = useMemo(
        () => [
          // Block shortcuts
          { trigger: '# ', style: 'h1' },
          { trigger: '## ', style: 'h2' },
          { trigger: '### ', style: 'h3' },
          { trigger: '#### ', style: 'h4' },
          { trigger: '##### ', style: 'h5' },
          { trigger: '###### ', style: 'h6' },
          { trigger: '> ', style: 'blockquote' },
          { trigger: '```', style: 'codeblock' },
          { trigger: '- ', style: 'unordered_list' },
          { trigger: '* ', style: 'unordered_list' },
          { trigger: '1.', style: 'ordered_list' },
          { trigger: '[] ', style: 'checkbox_list' },
          // Inline shortcuts
          { trigger: '`', style: 'inline_code', type: 'inline' as const },
          { trigger: '**', style: 'bold', type: 'inline' as const },
          { trigger: '*', style: 'italic', type: 'inline' as const },
          { trigger: '_', style: 'italic', type: 'inline' as const },
          { trigger: '~~', style: 'strikethrough', type: 'inline' as const },
        ],
        []
      );

      const handleChangeState = useCallback(
        (e: NativeSyntheticEvent<OnChangeStateEvent>) => {
          const nativeState = e.nativeEvent;
          setStyleState(nativeState);
          onEditorStateChange?.(
            mapToTlonBridgeState(nativeState, selectionRef.current)
          );
        },
        [onEditorStateChange]
      );

      const handleChangeSelection = useCallback(
        (e: NativeSyntheticEvent<OnChangeSelectionEvent>) => {
          selectionRef.current = {
            start: e.nativeEvent.start,
            end: e.nativeEvent.end,
            text: e.nativeEvent.text,
          };
          // Re-emit state so canSetLink updates based on new selection
          onEditorStateChange?.(
            mapToTlonBridgeState(styleState, selectionRef.current)
          );
        },
        [onEditorStateChange, styleState]
      );

      const handlePasteImages = useCallback(
        (e: NativeSyntheticEvent<OnPasteImagesEvent>) => {
          onPasteImages?.(e.nativeEvent.images as PastedImage[]);
        },
        [onPasteImages]
      );

      // Emit an initial default state on mount so the parent re-renders and
      // can see the ref (useImperativeHandle runs before this effect).
      useEffect(() => {
        onEditorStateChange?.(mapToTlonBridgeState(null));
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);

      // Build a TlonEditorBridge-compatible adapter object
      useImperativeHandle(
        ref,
        () => {
          const noop = () => {};

          const adapter = {
            // --- Style toggles the toolbar uses ---
            toggleBold: () => enrichedRef.current?.toggleBold(),
            toggleItalic: () => enrichedRef.current?.toggleItalic(),
            toggleStrike: () => enrichedRef.current?.toggleStrikeThrough(),
            toggleCode: () => enrichedRef.current?.toggleInlineCode(),
            toggleCodeBlock: () => enrichedRef.current?.toggleCodeBlock(),
            toggleBlockquote: () => enrichedRef.current?.toggleBlockQuote(),
            toggleOrderedList: () => enrichedRef.current?.toggleOrderedList(),
            toggleBulletList: () => enrichedRef.current?.toggleUnorderedList(),
            toggleTaskList: () =>
              enrichedRef.current?.toggleCheckboxList(false),
            toggleHeading: (level: number) => {
              const map: Record<number, () => void> = {
                1: () => enrichedRef.current?.toggleH1(),
                2: () => enrichedRef.current?.toggleH2(),
                3: () => enrichedRef.current?.toggleH3(),
                4: () => enrichedRef.current?.toggleH4(),
                5: () => enrichedRef.current?.toggleH5(),
                6: () => enrichedRef.current?.toggleH6(),
              };
              map[level]?.();
            },
            setImage: (url: string, width?: number, height?: number) =>
              enrichedRef.current?.setImage(url, width ?? 0, height ?? 0),

            // --- Link support ---
            setLink: (url: string) => {
              const sel = selectionRef.current;
              if (url) {
                enrichedRef.current?.setLink(sel.start, sel.end, sel.text, url);
              } else {
                enrichedRef.current?.removeLink(sel.start, sel.end);
              }
            },

            // --- Mention support ---
            setMention: (indicator: string, text: string, id: string) =>
              enrichedRef.current?.setMention(indicator, text, { id }),

            // --- Content methods ---
            setContent: (html: string) => enrichedRef.current?.setValue(html),
            getHTML: () =>
              enrichedRef.current?.getHTML() ?? Promise.resolve(''),
            getJSON: () => Promise.resolve({}),
            setSelection: noop,
            undo: noop,
            redo: noop,
            sink: noop,
            lift: noop,
            focus: () => enrichedRef.current?.focus(),
            blur: () => enrichedRef.current?.blur(),

            getEditorState: () =>
              mapToTlonBridgeState(styleState, selectionRef.current),
          } as unknown as TlonEditorBridge;

          return { editor: adapter };
        },
        [styleState]
      );

      return (
        <EnrichedTextInput
          ref={enrichedRef}
          testID={testID}
          placeholder={placeholder}
          placeholderTextColor={tamagui.tertiaryText.val}
          defaultValue={initialHtml}
          htmlStyle={htmlStyle}
          textShortcuts={nativeTextShortcuts}
          mentionIndicators={['@', '~']}
          onChangeHtml={handleChangeHtml}
          onChangeState={handleChangeState}
          onChangeSelection={handleChangeSelection}
          onPasteImages={handlePasteImages}
          onStartMention={onStartMention}
          onChangeMention={
            onChangeMention
              ? (e) => onChangeMention(e.indicator, e.text)
              : undefined
          }
          onEndMention={onEndMention}
          style={{
            color: tamagui.primaryText.val,
            fontSize: 16,
            ...(style as any),
          }}
        />
      );
    }
  )
);

EnrichedNoteInput.displayName = 'EnrichedNoteInput';
