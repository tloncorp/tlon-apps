import { ContactAvatar, SystemIconAvatar } from '../Avatar';
import type { SettingsRowModel } from './types';

/**
 * The React Native content at the start of a settings row. Web draws it in
 * place; the native lists host it inside their own row layout.
 */
export function SettingsRowLeading({
  row,
  compact,
}: {
  row: SettingsRowModel;
  /** Native rows are shorter than the web card rows. */
  compact?: boolean;
}) {
  const leading = row.leading;
  if (!leading) {
    return null;
  }

  switch (leading.kind) {
    case 'icon':
      return (
        <SystemIconAvatar
          icon={leading.icon}
          rounded
          size={compact ? '$3xl' : undefined}
          // Native rows sit on the secondary background, so the badge flips to
          // the primary one to stay visible.
          backgroundColor={compact ? '$background' : undefined}
        />
      );
    case 'contact':
      return (
        <ContactAvatar
          contactId={leading.contactId}
          size={row.prominent && compact ? '$4xl' : '$3xl'}
        />
      );
    case 'element':
      return leading.element;
  }
}
