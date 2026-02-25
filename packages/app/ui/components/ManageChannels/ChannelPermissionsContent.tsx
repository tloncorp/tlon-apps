import { Button } from '@tloncorp/ui';

import { MEMBERS_MARKER } from './channelFormUtils';

interface PermissionActionButtonsProps {
  onSelectRoles: () => void;
}

/**
 * The "Add roles" button.
 * Used by both CreateChannelPermissionsScreen and EditChannelPrivacyScreen.
 */
export function PermissionActionButtons({
  onSelectRoles,
}: PermissionActionButtonsProps) {
  return <Button onPress={onSelectRoles} label="Add roles" />;
}

/**
 * Process readers/writers arrays for submission.
 * If MEMBERS_MARKER is present, returns empty array (everyone has access).
 * Otherwise filters out MEMBERS_MARKER and returns the role IDs.
 */
export function processFinalPermissions(
  readers: string[],
  writers: string[],
  isPrivate = true
): { finalReaders: string[]; finalWriters: string[] } {
  const finalReaders = !isPrivate
    ? []
    : readers.includes(MEMBERS_MARKER)
      ? []
      : readers.filter((r) => r !== MEMBERS_MARKER);

  const finalWriters = !isPrivate
    ? []
    : writers.includes(MEMBERS_MARKER)
      ? []
      : writers.filter((w) => w !== MEMBERS_MARKER);

  return { finalReaders, finalWriters };
}
