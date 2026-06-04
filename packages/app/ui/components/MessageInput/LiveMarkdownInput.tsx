import {
  MarkdownTextInput,
  parseExpensiMark,
} from '@expensify/react-native-live-markdown';
import type {
  MarkdownRange,
  MarkdownStyle,
} from '@expensify/react-native-live-markdown';
import { forwardRef, memo } from 'react';
import type { TextInput, TextInputProps } from 'react-native';

import { findMentionRanges } from './mentionMarkdownRanges';

export type LiveMarkdownInputProps = TextInputProps & {
  markdownStyle?: MarkdownStyle;
};

// Worklet parser: base ExpensiMark styling + Tlon ship/role mention ranges.
function parseTlonMarkdown(text: string): MarkdownRange[] {
  'worklet';
  const base = parseExpensiMark(text);
  const mentions = findMentionRanges(text);
  // Sort by start only: the native formatter applies mention ranges as absolute
  // color attributes (it never reads surrounding font state), so they need no
  // secondary length/priority tiebreak the way font-merging ranges do.
  return base.concat(mentions).sort((a, b) => a.start - b.start);
}

export const LiveMarkdownInput = memo(
  forwardRef<TextInput, LiveMarkdownInputProps>(
    ({ multiline = true, markdownStyle, ...props }, ref) => {
      return (
        <MarkdownTextInput
          // MarkdownTextInput's ref type is narrower than TextInput; the wrapper
          // exposes the public TextInput ref.
          ref={ref as any}
          {...props}
          multiline={multiline}
          parser={parseTlonMarkdown}
          markdownStyle={markdownStyle}
        />
      );
    }
  )
);

LiveMarkdownInput.displayName = 'LiveMarkdownInput';
