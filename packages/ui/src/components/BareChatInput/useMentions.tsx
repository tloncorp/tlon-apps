import * as db from '@tloncorp/shared/db';
import { useState } from 'react';

export interface Mention {
  id: string;
  display: string;
  start: number;
  end: number;
}

export const useMentions = () => {
  const [showMentionPopup, setShowMentionPopup] = useState(false);
  const [mentionStartIndex, setMentionStartIndex] = useState<number | null>(
    null
  );
  const [mentionSearchText, setMentionSearchText] = useState<string>('');
  const [mentions, setMentions] = useState<Mention[]>([]);

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

    // Check if we're deleting a trigger symbol
    if (newText.length < oldText.length && showMentionPopup) {
      const deletedChar = oldText[cursorPosition];
      if (deletedChar === '@' || deletedChar === '~') {
        setShowMentionPopup(false);
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
      const hasSpace = textBetweenTriggerAndCursor.includes(' ');

      // Only show popup if we're right after the trigger or actively searching
      if (
        !hasSpace &&
        (cursorPosition === lastTriggerIndex + 1 ||
          (cursorPosition > lastTriggerIndex && !afterCursor.includes(' ')))
      ) {
        setShowMentionPopup(true);
        setMentionStartIndex(lastTriggerIndex);
        setMentionSearchText(textBetweenTriggerAndCursor);
      } else {
        setShowMentionPopup(false);
        setMentionStartIndex(null);
        setMentionSearchText('');
      }
    } else {
      setShowMentionPopup(false);
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

    const mentionDisplay = `${contact.id}`;
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
    setShowMentionPopup(false);
    setMentionStartIndex(null);
    setMentionSearchText('');

    return newText;
  };

  return {
    mentions,
    setMentions,
    mentionSearchText,
    setMentionSearchText,
    handleMention,
    handleSelectMention,
    showMentionPopup,
    setShowMentionPopup,
  };
};
