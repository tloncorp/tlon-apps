import * as db from '@tloncorp/shared/dist/db';
import { useState } from 'react';

interface Mention {
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
    // Check if we're deleting a trigger symbol
    if (newText.length < oldText.length && showMentionPopup) {
      const deletedChar = oldText[newText.length];
      if (deletedChar === '@' || deletedChar === '~') {
        setShowMentionPopup(false);
        setMentionStartIndex(null);
        setMentionSearchText('');
        return;
      }
    }

    // Check for @ symbol
    const lastAtSymbol = newText.lastIndexOf('@');
    if (lastAtSymbol >= 0 && lastAtSymbol === newText.length - 1) {
      setShowMentionPopup(true);
      setMentionStartIndex(lastAtSymbol);
      setMentionSearchText('');
    } else if (showMentionPopup && mentionStartIndex !== null) {
      // Update mention search text
      const searchText = newText.slice(mentionStartIndex + 1);
      if (!searchText.includes(' ')) {
        setMentionSearchText(searchText);
      } else {
        setShowMentionPopup(false);
        setMentionStartIndex(null);
        setMentionSearchText('');
      }
    }

    // Check for ~ symbol
    const lastSig = newText.lastIndexOf('~');
    if (lastSig >= 0 && lastSig === newText.length - 1) {
      setShowMentionPopup(true);
      setMentionStartIndex(lastSig);
      setMentionSearchText('');
    } else if (showMentionPopup && mentionStartIndex !== null) {
      // Update mention search text
      const searchText = newText.slice(mentionStartIndex + 1);
      if (!searchText.includes(' ')) {
        setMentionSearchText(searchText);
      } else {
        setShowMentionPopup(false);
        setMentionStartIndex(null);
        setMentionSearchText('');
      }
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
