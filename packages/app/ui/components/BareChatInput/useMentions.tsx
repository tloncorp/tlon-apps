import { useQuery } from '@tanstack/react-query';
import { ALL_MENTION_ID as allID } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { valid } from '@urbit/aura';
import { useMemo, useState } from 'react';

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

export function createMentionRoleOptions(
  groupRoles: db.GroupRole[]
): MentionOption[] {
  const roles = groupRoles.map<MentionOption>((role) => ({
    id: role.id,
    title: role.title || role.id,
    subtitle: role.description,
    type: 'group',
    priority: 7,
  }));

  const all: MentionOption = {
    id: ALL_MENTION_ID,
    title: 'All',
    subtitle: 'All members in this channel',
    type: 'group',
    priority: 8,
  };
  return [...roles, all];
}

export const useMentions = ({
  chatId,
  roleOptions,
}: {
  chatId: string;
  roleOptions: MentionOption[];
}) => {
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
    placeholderData: (previousData) => {
      return previousData || [];
    },
    enabled: isMentionModeActive && mentionSearchText.trim().length > 0,
    select: (data) => {
      return data.map((candidate) => ({
        id: candidate.id,
        title: candidate.nickname || candidate.id,
        subtitle: formatUserId(candidate.id, true)?.display,
        type: 'contact' as const,
        priority: candidate.priority,
        contact: {
          id: candidate.id,
          nickname: candidate.nickname,
          avatarImage: candidate.avatarImage,
          bio: candidate.bio,
          status: candidate.status,
          color: candidate.color,
        } as db.Contact,
      }));
    },
  });

  // Combine role options and mention candidates
  const validOptions = useMemo(() => {
    const validRoleOptions = roleOptions.filter(
      (o) =>
        mentionSearchText.trim().length > 0 &&
        o.title?.toLowerCase().startsWith(mentionSearchText.toLowerCase())
    );
    return [...validRoleOptions, ...mentionCandidates].sort(
      (a, b) => a.priority - b.priority
    );
  }, [roleOptions, mentionCandidates, mentionSearchText]);

  const hasMentionCandidates = useMemo(() => {
    return validOptions.length > 0;
  }, [validOptions]);

  const handleMention = (
    oldText: string,
    newText: string,
    explicitCursorPosition?: number
  ) => {
    // Use explicit cursor position when available (web), fall back to diff-based heuristic
    let cursorPosition: number;
    let firstDiffIndex: number | null = null;
    if (explicitCursorPosition != null) {
      cursorPosition = explicitCursorPosition;
    } else {
      cursorPosition = newText.length;
      if (oldText.length !== newText.length) {
        for (let i = 0; i < Math.min(oldText.length, newText.length); i++) {
          if (oldText[i] !== newText[i]) {
            firstDiffIndex = i;
            cursorPosition = i + (newText.length > oldText.length ? 1 : 0);
            break;
          }
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
          cursorPosition > lastTriggerIndex)
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
      const delta = newText.length - oldText.length;
      const editPosition =
        explicitCursorPosition != null
          ? cursorPosition - (delta > 0 ? delta : 0)
          : firstDiffIndex ?? cursorPosition;
      const updatedMentions = mentions
        .map((mention) => {
          if (mention.start >= editPosition) {
            return {
              ...mention,
              start: mention.start + delta,
              end: mention.end + delta,
            };
          }
          return mention;
        })
        .filter(
          (mention) =>
            mention.start >= 0 &&
            mention.end <= newText.length &&
            newText.slice(mention.start, mention.end) === mention.display
        );
      if (
        updatedMentions.length !== mentions.length ||
        updatedMentions.some((m, i) => m.start !== mentions[i]?.start)
      ) {
        setMentions(updatedMentions);
      }
    }
  };

  const handleSelectMention = (option: MentionOption, text: string) => {
    if (mentionStartIndex === null) return;

    const display = option.title || option.id;
    const mentionDisplay = valid('p', display) ? display : `@${display}`;
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

  const resetMentionMode = () => {
    setIsMentionModeActive(false);
    setMentionStartIndex(null);
    setMentionSearchText('');
    setWasDismissedByEscape(false);
    setLastDismissedTriggerIndex(null);
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
    resetMentionMode,
  };
};
