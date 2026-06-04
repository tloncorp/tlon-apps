import { MarkdownTextInput } from '@expensify/react-native-live-markdown';
import type {
  MarkdownRange,
  MarkdownStyle,
} from '@expensify/react-native-live-markdown';
import { forwardRef, memo, useMemo } from 'react';
import type {
  NativeSyntheticEvent,
  TextInput,
  TextInputProps,
} from 'react-native';

import { parseTlonMarkdownRanges } from './tlonMarkdownParser';

export type PastedImage = {
  uri: string;
  type: string;
  width: number;
  height: number;
};

export type LiveMarkdownInputProps = TextInputProps & {
  markdownStyle?: MarkdownStyle;
  // Highlight ranges for the tracked mention entities (by position). Computed
  // from the editor's mention list so only picked/loaded mentions highlight —
  // a typed duplicate of the same name does not.
  mentionRanges?: MarkdownRange[];
  onPasteImages?: (
    event: NativeSyntheticEvent<{ images: PastedImage[] }>
  ) => void;
};

export const LiveMarkdownInput = memo(
  forwardRef<TextInput, LiveMarkdownInputProps>(
    ({ multiline = true, markdownStyle, mentionRanges, ...props }, ref) => {
      // Build the worklet parser; Tlon-dialect formatting + the entity mention
      // ranges supplied by the caller (no ExpensiMark, no text-pattern mention
      // detection).
      const parser = useMemo<(text: string) => MarkdownRange[]>(() => {
        const mentions = mentionRanges ?? [];
        return (text: string) => {
          'worklet';
          const base = parseTlonMarkdownRanges(text);
          // Sort by start only: the native formatter applies mention ranges as
          // absolute color attributes (it never reads surrounding font state),
          // so they need no secondary length/priority tiebreak the way
          // font-merging ranges do.
          return base.concat(mentions).sort((a, b) => a.start - b.start);
        };
      }, [mentionRanges]);

      return (
        <MarkdownTextInput
          // MarkdownTextInput's ref type is narrower than TextInput; the wrapper
          // exposes the public TextInput ref.
          ref={ref as any}
          {...props}
          multiline={multiline}
          parser={parser}
          markdownStyle={markdownStyle}
        />
      );
    }
  )
);

LiveMarkdownInput.displayName = 'LiveMarkdownInput';
