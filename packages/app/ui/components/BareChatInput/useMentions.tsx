import { useQuery } from '@tanstack/react-query';
import { escapeRegExp, isValidPatp } from '@tloncorp/shared';
import { ALL_MENTION_ID as allID } from '@tloncorp/shared';
import { getCurrentUserId } from '@tloncorp/shared/api';
import * as db from '@tloncorp/shared/db';
import { useMemo, useState } from 'react';

import { emptyContact } from '../../../fixtures/fakeData';
import { formatUserId } from '../../utils';

export const ALL_MENTION_ID = allID;

export interface Mention {
  id: string;
  display: string;
  start: number;
  end: number;
}

export interface MentionOption {
  id: string;
  type: 'contact' | 'group';
  title?: string | null;
  subtitle?: string | null;
  priority: number;
  contact?: db.Contact;
}

export function getMentionPriority(member: db.ChatMember): number {
  const { contact } = member;
  if (!contact) {
    return 1;
  }

  if (contact.isContact) {
    return 3;
  }

  if (contact.isContactSuggestion) {
    return 2;
  }

  return 1;
}

export function createMentionOptions(
  groupMembers: db.ChatMember[],
  groupRoles: db.GroupRole[]
): MentionOption[] {
  const currentUserId = getCurrentUserId();
  const members = groupMembers
    .filter((member) => member.contactId !== currentUserId)
    .map<MentionOption>((member) => ({
      id: member.contactId,
      title: member.contact?.nickname || member.contactId,
      subtitle: formatUserId(member.contactId, true)?.display,
      type: 'contact',
      priority: getMentionPriority(member),
      contact: member.contact || emptyContact,
    }));

  const roles = groupRoles.map<MentionOption>((role) => ({
    id: role.id,
    title: role.title || role.id,
    subtitle: role.description,
    type: 'group',
    priority: 4,
  }));

  const all: MentionOption = {
    id: ALL_MENTION_ID,
    title: 'All',
    subtitle: 'All members in this channel',
    type: 'group',
    priority: 5,
  };
  return [all, ...members, ...roles].sort((a, b) => a.priority - b.priority);
}

export const useMentions = ({ chatId }: { chatId: string }) => {
  const [isMentionModeActive, setIsMentionModeActive] = useState(false);
  const [mentionStartIndex, setMentionStartIndex] = useState<number | null>(
    null
  );
  const [mentionSearchText, setMentionSearchText] = useState<string>('');
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [wasDismissedByEscape, setWasDismissedByEscape] = useState(false);
  const [lastDismissedTriggerIndex, setLastDismissedTriggerIndex] = useState<
    number | null
  >(null);

  const { data: mentionCandidates = [] } = useQuery({
    queryKey: ['mentionCandidates', chatId, mentionSearchText],
    queryFn: () =>
      db.getMentionCandidates({ chatId, query: mentionSearchText }),
    enabled: isMentionModeActive && mentionSearchText.trim().length > 0,
  });

  const validOptions = useMemo(() => {
    const options: MentionOption[] = mentionCandidates.map((candidate) => ({
      id: candidate.id,
      title: candidate.priority_order + (candidate.nickname || candidate.id),
      subtitle: formatUserId(candidate.id, true)?.display,
      type: 'contact' as const,
      priority: candidate.priority_order,
      contact: {
        id: candidate.id,
        nickname: candidate.nickname,
        avatarImage: candidate.avatarImage,
        bio: candidate.bio,
        status: candidate.status,
        color: candidate.color,
      } as db.Contact,
    }));

    // Add "All" option if we have a search term
    if (isMentionModeActive && mentionSearchText.trim().length > 0) {
      const allOption: MentionOption = {
        id: ALL_MENTION_ID,
        title: 'All',
        subtitle: 'All members in this channel',
        type: 'group',
        priority: 0,
      };

      // Only include "All" if it matches the search
      if ('all'.includes(mentionSearchText.toLowerCase())) {
        options.unshift(allOption);
      }
    }

    return options.sort((a, b) => a.priority - b.priority);
  }, [mentionCandidates, isMentionModeActive, mentionSearchText]);

  const hasMentionCandidates = useMemo(() => {
    return validOptions.length > 0;
  }, [validOptions]);

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

  const handleSelectMention = (option: MentionOption, text: string) => {
    if (mentionStartIndex === null) return;

    const display = option.title || option.id;
    const mentionDisplay = isValidPatp(display) ? display : `@${display}`;
    const beforeMention = text.slice(0, mentionStartIndex);
    const afterMention = text.slice(
      mentionStartIndex + (mentionSearchText?.length || 0) + 1
    );

    const newText = beforeMention + mentionDisplay + ' ' + afterMention;
    const newMention: Mention = {
      id: option.id,
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
    validOptions,
    setMentions,
    mentionSearchText,
    setMentionSearchText,
    handleMention,
    handleSelectMention,
    isMentionModeActive,
    setIsMentionModeActive,
    handleMentionEscape,
    hasMentionCandidates,
  };
};
