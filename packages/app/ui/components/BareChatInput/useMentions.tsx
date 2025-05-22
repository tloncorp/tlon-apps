import * as db from '@tloncorp/shared/db';
import { useState } from 'react';

export interface Mention {
  id: string;
  display: string;
  start: number;
  end: number;
}

export const useMentions = () => {
  const [isMentionModeActive, setIsMentionModeActive] = useState(false);
  const [hasMentionCandidates, setHasMentionCandidates] = useState(false);
  const [mentionStartIndex, setMentionStartIndex] = useState<number | null>(
    null
  );
  const [mentionSearchText, setMentionSearchText] = useState<string>('');
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [wasDismissedByEscape, setWasDismissedByEscape] = useState(false);
  const [lastDismissedTriggerIndex, setLastDismissedTriggerIndex] = useState<
    number | null
  >(null);

  const handleMention = (oldText: string, newText: string) => {
    // Find cursor position by comparing old and new text
    let cursorPosition = newText.length;
    if (oldText.length !== newText.length) {
      for (let i = 0; i < Math.min(oldText.length, newText.length); i++) {
        if (oldText[i] !== newText[i]) {
          cursorPosition = i + (newText.length > oldText.length ? 1 : 0);
          break;
        }
      }
    }

    // Clear escape state when starting a new word
    if (
      oldText.length < newText.length &&
      newText[cursorPosition - 1] === ' '
    ) {
      setWasDismissedByEscape(false);
    }

    // Clear escape state when deleting past the escaped trigger
    if (wasDismissedByEscape && lastDismissedTriggerIndex !== null) {
      if (
        oldText.length > newText.length &&
        cursorPosition <= lastDismissedTriggerIndex
      ) {
        setWasDismissedByEscape(false);
        setLastDismissedTriggerIndex(null);
      }
    }

    // Check if we're deleting a trigger symbol
    if (newText.length < oldText.length && isMentionModeActive) {
      const deletedChar = oldText[cursorPosition];
      if (deletedChar === '@' || deletedChar === '~') {
        setIsMentionModeActive(false);
        setMentionStartIndex(null);
        setMentionSearchText('');
        return;
      }
    }

    // Get the text before and after cursor
    const beforeCursor = newText.slice(0, cursorPosition);
    const afterCursor = newText.slice(cursorPosition);

    // Find the last trigger symbol before cursor
    const lastAtSymbol = beforeCursor.lastIndexOf('@');
    const lastSig = beforeCursor.lastIndexOf('~');
    const lastTriggerIndex = Math.max(lastAtSymbol, lastSig);

    if (lastTriggerIndex >= 0) {
      // Check if there's a space between the trigger and cursor
      const textBetweenTriggerAndCursor = beforeCursor.slice(
        lastTriggerIndex + 1
      );
      const textBeforeTrigger = beforeCursor.slice(
        lastTriggerIndex - 1,
        lastTriggerIndex
      );
      const whitespaceBeforeOrFirst =
        lastTriggerIndex === 0 || textBeforeTrigger.match(/\s+/);
      const spaceAfter = textBetweenTriggerAndCursor.includes(' ');

      // Only show popup if:
      // 1. We're right after the trigger or actively searching
      // 2. AND it wasn't dismissed by escape for this trigger index
      // 3. OR it's a new trigger position different from the dismissed one
      const isDismissedTrigger =
        wasDismissedByEscape && lastTriggerIndex === lastDismissedTriggerIndex;
      if (
        whitespaceBeforeOrFirst &&
        !spaceAfter &&
        !isDismissedTrigger &&
        (cursorPosition === lastTriggerIndex + 1 ||
          (cursorPosition > lastTriggerIndex && !afterCursor.includes(' ')))
      ) {
        setIsMentionModeActive(true);
        setMentionStartIndex(lastTriggerIndex);
        setMentionSearchText(textBetweenTriggerAndCursor);
      } else {
        setIsMentionModeActive(false);
        setMentionStartIndex(null);
        setMentionSearchText('');
      }
    } else {
      setIsMentionModeActive(false);
      setMentionStartIndex(null);
      setMentionSearchText('');
    }

    // Update mention positions when text changes
    if (mentions.length > 0) {
      const updatedMentions = mentions.filter(
        (mention) =>
          mention.start <= newText.length &&
          newText.slice(mention.start, mention.end) === mention.display
      );
      if (updatedMentions.length !== mentions.length) {
        setMentions(updatedMentions);
      }
    }
  };

  const handleSelectMention = (contact: db.Contact, text: string) => {
    if (mentionStartIndex === null) return;

    const mentionDisplay = contact.nickname || contact.id;
    const beforeMention = text.slice(0, mentionStartIndex);
    const afterMention = text.slice(
      mentionStartIndex + (mentionSearchText?.length || 0) + 1
    );

    const newText = beforeMention + mentionDisplay + ' ' + afterMention;
    const newMention: Mention = {
      id: contact.id,
      display: mentionDisplay,
      start: mentionStartIndex,
      end: mentionStartIndex + mentionDisplay.length,
    };

    setMentions((prev) => [...prev, newMention]);
    setIsMentionModeActive(false);
    setMentionStartIndex(null);
    setMentionSearchText('');
    setWasDismissedByEscape(false);
    setLastDismissedTriggerIndex(null);

    return newText;
  };

  const handleMentionEscape = () => {
    setIsMentionModeActive(false);
    setWasDismissedByEscape(true);
    setLastDismissedTriggerIndex(mentionStartIndex);
  };

  return {
    mentions,
    setMentions,
    mentionSearchText,
    setMentionSearchText,
    handleMention,
    handleSelectMention,
    isMentionModeActive,
    setIsMentionModeActive,
    handleMentionEscape,
    hasMentionCandidates,
    setHasMentionCandidates,
  };
};
