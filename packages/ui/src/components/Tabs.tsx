import { ReactNode } from 'react';
import { styled, withStaticProperties } from 'tamagui';
import { SizableText, XStack } from 'tamagui';

import Pressable from './Pressable';

const TabsWrapper = styled(XStack, {
  width: '100%',
});

const TabTitleComponent = styled(SizableText, {
  width: 100,
  textAlign: 'center',
  paddingVertical: '$m',
  variants: {
    active: {
      true: {
        color: '$primaryText',
      },
      false: {
        color: '$secondaryText',
      },
    },
  } as const,
});

const TabComponent = ({
  onTabPress,
  children,
  name,
  activeTab,
}: {
  onTabPress: () => void;
  children: ReactNode;
  name: string;
  activeTab: string;
}) => {
  return (
    <XStack
      flexGrow={1}
      borderBottomWidth={activeTab === name ? 1 : 0}
      borderColor="$primaryText"
      justifyContent="center"
    >
      <Pressable onPress={() => onTabPress()}>{children}</Pressable>
    </XStack>
  );
};

export const Tabs = withStaticProperties(TabsWrapper, {
  Tab: TabComponent,
  Title: TabTitleComponent,
});
