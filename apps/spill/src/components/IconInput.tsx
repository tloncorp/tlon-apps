import React, {useCallback, useState} from 'react';
import {Icon, IconName, XStack} from '@ochre';
import * as db from '@db';

const AllIcons: IconName[] = [
  'Add',
  'Attachment',
  'Bang',
  'ChannelGalleries',
  'ChannelNote',
  'ChannelNotebooks',
  'ChannelTalk',
  'Channel',
  'Checkmark',
  'ChevronDown',
  'ChevronLeft',
  'ChevronRight',
  'ChevronUp',
  'Clock',
  'Close',
  'Discover',
  'Dragger',
  'Face',
  'Filter',
  'Gift',
  'Home',
  'Label',
  'LeftSidebar',
  'Mail',
  'Messages',
  'Notifications',
  'Overflow',
  'Placeholder',
  'Profile',
  'RightSidebar',
  'Search',
  'Send',
];

export function IconInput({
  value,
  onChange,
}: {
  value?: db.TabIcon;
  onChange?: (newValue: db.TabIcon) => void;
}) {
  const [iconIndex, setIconIndex] = useState(
    AllIcons.indexOf(
      value && value.type === 'icon' ? value.value : AllIcons[0]!,
    ),
  );
  const handlePressIcon = useCallback(() => {
    const nextIndex = (iconIndex + 1) % AllIcons.length;
    setIconIndex(nextIndex);
    onChange?.({
      color: value?.color || 'transparent',
      type: 'icon',
      value: AllIcons[nextIndex]!,
    });
  }, [onChange, iconIndex, value?.color]);
  return (
    <XStack onPress={handlePressIcon}>
      <Icon icon={AllIcons[iconIndex]!} size="$l" />
    </XStack>
  );
}
