import { View } from 'react-native';
import { getTokenValue } from 'tamagui';

import { ContactAvatar, SystemIconAvatar } from '../Avatar';
import type { SettingsRowModel } from './types';

/** The side of the square the row's leading content occupies. */
export function getSettingsRowLeadingSize(
  row: SettingsRowModel,
  compact: boolean
) {
  const large = getTokenValue('$4xl', 'size');
  const small = getTokenValue('$3xl', 'size');
  switch (row.leading?.kind) {
    case 'icon':
      return compact ? small : large;
    case 'contact':
      return row.prominent && compact ? large : small;
    default:
      return row.prominent || !compact ? large : small;
  }
}

/**
 * Leading content for a native row, at a fixed size. Native lists host it with
 * `matchContents`, which takes its size from the hosted view, so the view must
 * have one rather than stretching across the row. The row takes the tap.
 */
export function HostedSettingsRowLeading({ row }: { row: SettingsRowModel }) {
  const size = getSettingsRowLeadingSize(row, true);
  return (
    <View pointerEvents="none" style={{ width: size, height: size }}>
      <SettingsRowLeading row={row} compact />
    </View>
  );
}

/**
 * The React Native content at the start of a settings row. Web draws it in
 * place; the native lists host it inside their own row layout.
 */
export function SettingsRowLeading({
  row,
  compact = false,
}: {
  row: SettingsRowModel;
  /** Native rows are shorter than the web card rows. */
  compact?: boolean;
}) {
  const leading = row.leading;
  if (!leading) {
    return null;
  }
  const size = getSettingsRowLeadingSize(row, compact);

  switch (leading.kind) {
    case 'icon':
      return (
        <SystemIconAvatar
          icon={leading.icon}
          rounded
          width={size}
          height={size}
          // Native rows sit on the secondary background, so the badge flips to
          // the primary one to stay visible.
          backgroundColor={compact ? '$background' : undefined}
        />
      );
    case 'contact':
      return (
        <ContactAvatar
          contactId={leading.contactId}
          size="custom"
          width={size}
          height={size}
          borderRadius={size > getTokenValue('$3xl', 'size') ? '$s' : '$xs'}
        />
      );
    case 'element':
      return leading.render({ size, compact });
  }
}
