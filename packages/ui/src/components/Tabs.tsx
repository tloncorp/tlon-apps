import { ReactNode } from 'react';
import { SizableText, XStack, styled, withStaticProperties } from 'tamagui';

import { useBoundHandler } from './ListItem/listItemUtils';

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

const TabFrame = styled(XStack, {
  flexGrow: 1,
  justifyContent: 'center',
  borderColor: '$primaryText',
  variants: {
    active: {
      true: {
        borderBottomWidth: 1,
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
