import Clipboard from '@react-native-clipboard/clipboard';
import { useCallback, useState } from 'react';

import { Icon } from '../tmp/components/Icon';
import { ListItem } from './ListItem';
import Pressable from '../tmp/components/Pressable';

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
    <Pressable borderRadius="$xl" onPress={copy}>
      <ListItem disabled={!copyable}>
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
    </Pressable>
  );
}
