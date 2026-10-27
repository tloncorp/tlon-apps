import { ALL_MENTION_ID as allID } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { valid } from '@urbit/aura';
import { useCallback, useMemo, useRef, useState } from 'react';

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

export interface MentionSelectionResult {
  text: string;
  cursorPosition: number;
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

// The first index where the two strings differ, or the shorter length when
// one is a prefix of the other.
export function firstDifference(a: string, b: string) {
  let index = 0;
  while (index < a.length && a[index] === b[index]) {
    index += 1;
  }
  return index;
}

// Moves the mentions at or after an edit by its length change, dropping any
// the edit broke.
export function shiftMentions(
  mentions: Mention[],
  editPosition: number,
  delta: number,
  newText: string
): Mention[] {
  return mentions
    .map((mention) =>
      mention.start >= editPosition
        ? { ...mention, start: mention.start + delta, end: mention.end + delta }
        : mention
    )
    .filter(
      (mention) =>
        mention.start >= 0 &&
        mention.end <= newText.length &&
        newText.slice(mention.start, mention.end) === mention.display
    );
}

// Where an index lands after the same edit, or null when the edit removed the
// text it pointed into.
export function shiftIndex(
  index: number,
  editPosition: number,
  delta: number
): number | null {
  if (index < editPosition) {
    return index;
  }
  return index >= editPosition - Math.min(delta, 0) ? index + delta : null;
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
  // shiftActiveMention runs after an async lookup, possibly before the render
  // that follows a keystroke, so every write updates this ref along with state.
  const mentionStartIndexRef = useRef<number | null>(null);
  const setTrigger = useCallback((next: number | null) => {
    mentionStartIndexRef.current = next;
    setMentionStartIndex(next);
  }, []);
  const [mentionSearchText, setMentionSearchText] = useState<string>('');
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [wasDismissedByEscape, setWasDismissedByEscape] = useState(false);
  const [lastDismissedTriggerIndex, setLastDismissedTriggerIndex] = useState<
    number | null
  >(null);

  const { data: mentionCandidateRows } = store.useMentionCandidates({
    chatId,
    query: mentionSearchText,
    enabled: isMentionModeActive && mentionSearchText.trim().length > 0,
  });

  const mentionCandidates = useMemo(
    () =>
      (mentionCandidateRows ?? []).map((candidate) => ({
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
      })),
    [mentionCandidateRows]
  );

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
        const index = firstDifference(oldText, newText);
        if (index < Math.min(oldText.length, newText.length)) {
          firstDiffIndex = index;
          cursorPosition = index + (newText.length > oldText.length ? 1 : 0);
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
        setTrigger(null);
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
        setTrigger(lastTriggerIndex);
        setMentionSearchText(textBetweenTriggerAndCursor);
      } else {
        setIsMentionModeActive(false);
        setTrigger(null);
        setMentionSearchText('');
      }
    } else {
      setIsMentionModeActive(false);
      setTrigger(null);
      setMentionSearchText('');
    }

    // Update mention positions when text changes
    if (mentions.length > 0) {
      const delta = newText.length - oldText.length;
      const editPosition =
        explicitCursorPosition != null
          ? cursorPosition - (delta > 0 ? delta : 0)
          : (firstDiffIndex ?? cursorPosition);
      const updatedMentions = shiftMentions(
        mentions,
        editPosition,
        delta,
        newText
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

    const replacedTextEnd =
      mentionStartIndex + (mentionSearchText?.length || 0) + 1;
    const newText = beforeMention + mentionDisplay + ' ' + afterMention;
    const newMention: Mention = {
      id: option.id,
      display: mentionDisplay,
      start: mentionStartIndex,
      end: mentionStartIndex + mentionDisplay.length,
    };
    const replacementDelta =
      mentionDisplay.length + 1 - (replacedTextEnd - mentionStartIndex);

    // Keep the array sorted by position: downstream serialization
    // (textAndMentionsToContent/processLine) consumes mentions in array order.
    setMentions((prev) =>
      [
        ...prev
          .filter(
            (mention) =>
              mention.end <= mentionStartIndex ||
              mention.start >= replacedTextEnd
          )
          .map((mention) =>
            mention.start >= replacedTextEnd
              ? {
                  ...mention,
                  start: mention.start + replacementDelta,
                  end: mention.end + replacementDelta,
                }
              : mention
          ),
        newMention,
      ].sort((a, b) => a.start - b.start)
    );
    setIsMentionModeActive(false);
    setTrigger(null);
    setMentionSearchText('');
    setWasDismissedByEscape(false);
    setLastDismissedTriggerIndex(null);

    return {
      text: newText,
      cursorPosition: beforeMention.length + mentionDisplay.length + 1,
    };
  };

  const handleMentionEscape = () => {
    setIsMentionModeActive(false);
    setWasDismissedByEscape(true);
    setLastDismissedTriggerIndex(mentionStartIndex);
  };

  // Light dismiss for gestures like tapping outside the popup. Unlike
  // handleMentionEscape (which "poisons" the current trigger index so the
  // popup doesn't reopen as the user keeps typing), this just hides the
  // popup; the next keystroke re-evaluates the mention trigger normally.
  const handleMentionSoftDismiss = () => {
    setIsMentionModeActive(false);
  };

  const shiftActiveMention = useCallback(
    (editPosition: number, delta: number) => {
      const current = mentionStartIndexRef.current;
      if (current !== null) {
        const next = shiftIndex(current, editPosition, delta);
        setTrigger(next);
        if (next === null) {
          setIsMentionModeActive(false);
          setMentionSearchText('');
        }
      }
      setLastDismissedTriggerIndex((dismissed) =>
        dismissed === null
          ? dismissed
          : shiftIndex(dismissed, editPosition, delta)
      );
    },
    [setTrigger]
  );

  const resetMentionMode = () => {
    setIsMentionModeActive(false);
    setTrigger(null);
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
    handleMentionSoftDismiss,
    hasMentionCandidates,
    resetMentionMode,
    shiftActiveMention,
  };
};
