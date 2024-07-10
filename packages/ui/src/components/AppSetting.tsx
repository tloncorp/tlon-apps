import Clipboard from '@react-native-clipboard/clipboard';
import { useCallback, useState } from 'react';

import { SizableText, View, XStack, YStack } from '../core';
import { Icon } from './Icon';
import { ListItem } from './ListItem';

interface Props {
  title: string;
  value: string;
  copyable?: boolean;
}

export function AppSetting({ title, value, copyable = true }: Props) {
  const [didCopy, setDidCopy] = useState(false);

  const copy = useCallback(() => {
    if (didCopy) return;
    Clipboard.setString(value);
    setDidCopy(true);
    setTimeout(() => {
      setDidCopy(false);
    }, 3000);
  }, [didCopy, value]);

  return (
    <ListItem onPress={copy} disabled={!copyable}>
      <ListItem.MainContent>
        <ListItem.Title>{title}</ListItem.Title>
        <ListItem.Subtitle>{value}</ListItem.Subtitle>
      </ListItem.MainContent>
      {copyable && (
        <ListItem.EndContent>
          <Icon color="$tertiaryText" type={didCopy ? 'Checkmark' : 'Copy'} />
        </ListItem.EndContent>
      )}
    </ListItem>
  );
}
