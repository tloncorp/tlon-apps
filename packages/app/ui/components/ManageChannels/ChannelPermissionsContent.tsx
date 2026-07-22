import { Button } from '@tloncorp/ui';

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
