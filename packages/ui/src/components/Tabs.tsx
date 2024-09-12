import { ReactNode } from 'react';
import { XStack, styled, withStaticProperties } from 'tamagui';

import { useBoundHandler } from './ListItem/listItemUtils';
import { Text } from './TextV2';

const TabsWrapper = styled(XStack, {
  width: '100%',
});

const TabTitleComponent = styled(Text, {
  textAlign: 'center',
  paddingVertical: '$m',
  size: '$label/m',
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

const TabFrame = styled(XStack, {
  flexBasis: 1,
  flexGrow: 1,
  justifyContent: 'center',
  alignItems: 'center',
  borderBottomWidth: 1,
  borderColor: '$shadow',
  height: '$4xl',
  variants: {
    active: {
      true: {
        borderColor: '$primaryText',
      },
    },
  },
});

const TabComponent = <T extends string>({
  onTabPress,
  children,
  name,
  activeTab,
}: {
  onTabPress: (name: T) => void;
  children: ReactNode;
  name: T;
  activeTab: string;
}) => {
  const handlePress = useBoundHandler(name, onTabPress);
  return (
    <TabFrame active={activeTab === name} onPress={handlePress}>
      {children}
    </TabFrame>
  );
};

export const Tabs = withStaticProperties(TabsWrapper, {
  Tab: TabComponent,
  Title: TabTitleComponent,
});
