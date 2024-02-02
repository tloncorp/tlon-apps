import * as db from '@db';
import {Button, Icon, ScrollView, Stack, XStack, SizableText} from '@ochre';
import {LinearGradient} from '@tamagui/linear-gradient';
import React, {useCallback, useMemo} from 'react';
import {WithSafeAreaInsetsProps} from 'react-native-safe-area-context';
import {styled} from 'tamagui';

interface TabBarProps {
  onPressAddTab?: () => void;
  onPressTab?: (tabIndex: number) => void;
  onLongPressTab?: (tabIndex: number) => void;
  tabGroup: db.TabGroupSettings | null;
  activeIndex?: number;
}

export function TabBar({
  insets,
  ...props
}: TabBarProps & WithSafeAreaInsetsProps) {
  const bottomInset = useMemo(() => {
    return insets.bottom;
  }, [insets.bottom]);
  return <TabBarComponent {...props} bottomInset={bottomInset} />;
}

const defaultTabs: db.TabSettings[] = [
  {
    icon: {
      type: 'icon',
      value: 'Channel',
      color: '$color',
    },
    query: {
      groupBy: 'group',
    },
  },
  {
    icon: {
      type: 'icon',
      value: 'ChannelTalk',
      color: '$color',
    },
    query: {
      groupBy: 'channel',
    },
  },
];

const TabBarComponent = React.memo(
  ({
    bottomInset,
    tabGroup,
    activeIndex,
    onPressTab,
    onLongPressTab,
    onPressAddTab,
  }: TabBarProps & {bottomInset: number}) => {
    return (
      <TabBarContainer bottom={bottomInset}>
        <SizableText color="$primaryText">Hi</SizableText>
        <TabBarShadow>
          {tabGroup?.tabs?.length ? (
            <TabBarTabList>
              <ScrollView
                horizontal
                flexShrink={1}
                showsHorizontalScrollIndicator={false}>
                <TabBarTabs flexShrink={1}>
                  {[...defaultTabs, ...tabGroup.tabs].map((s, index) => {
                    return (
                      <TabBarButton
                        // Using index to access settings as the realm mapped
                        // object is uncached and its identity will change each
                        // render.
                        // TODO: Need a global method for dealing with this
                        settings={tabGroup.tabs[index]!}
                        index={index}
                        key={index}
                        isActive={activeIndex === index}
                        onPress={onPressTab}
                        onLongPress={onLongPressTab}
                      />
                    );
                  })}
                </TabBarTabs>
              </ScrollView>
              {tabGroup.tabs.length > 5 ? <TabBarLinearGradient /> : null}
            </TabBarTabList>
          ) : null}
        </TabBarShadow>
        <TabBarShadow flexShrink={0}>
          <TabBarCreateButton flex={0} onPress={onPressAddTab}>
            <Icon icon="Add" size="$l" color="$tertiaryText" />
          </TabBarCreateButton>
        </TabBarShadow>
      </TabBarContainer>
    );
  },
);

const TabBarContainer = styled(XStack, {
  position: 'absolute',
  bottom: 0,
  left: 0,
  width: '100%',
  justifyContent: 'center',
});

const TabBarContent = styled(XStack, {
  padding: '$m',
  gap: '$s',
  maxWidth: '100%',
});

const TabBarTabList = styled(XStack, {
  flexShrink: 1,
  borderRadius: '$xxxl',
  borderWidth: 1,
  borderColor: '$border',
  backgroundColor: '$background',
  overflow: 'hidden',
});

const TabBarShadow = styled(Stack, {
  flexShrink: 1,
  backgroundColor: '$background',
  borderRadius: '$xxxl',
  shadowColor: '$black',
  shadowOffset: {width: 0, height: 0},
  shadowOpacity: 0.1,
  shadowRadius: 8,
});

const TabBarTabs = styled(XStack, {
  flexShrink: 1,
  paddingHorizontal: '$m',
});

function TabBarLinearGradient() {
  return (
    <LinearGradient
      pointerEvents={'none'}
      start={{x: 0, y: 0}}
      end={{x: 1, y: 0}}
      colors={['rgba(255,255,255, 0)', 'rgba(255,255,255, 1)']}
      position={'absolute'}
      right={0}
      top={0}
      bottom={0}
      width={50}
    />
  );
}

function TabBarButton({
  settings,
  index,
  onPress,
  onLongPress,
  isActive,
}: {
  settings: db.TabSettings;
  index: number;
  onPress?: (tabIndex: number) => void;
  onLongPress?: (tabIndex: number) => void;
  isActive: boolean;
}) {
  const defaultIcon = useMemo(() => db.TabSettings.default()?.icon, []);
  const icon = settings?.icon ?? defaultIcon;

  const handlePress = useCallback(() => {
    onPress?.(index);
  }, [index, onPress]);

  const handleLongPress = useCallback(() => {
    onLongPress?.(index);
  }, [index, onLongPress]);

  return (
    <TabBarButtonContainer onPress={handlePress} onLongPress={handleLongPress}>
      {icon.type === 'icon' && (
        <Icon
          size="$l"
          icon={icon.value}
          color={isActive ? '$primaryText' : '$tertiaryText'}
        />
      )}
    </TabBarButtonContainer>
  );
}

const TabBarButtonContainer = styled(Stack, {
  borderRadius: '$m',
  justifyContent: 'center',
  alignItems: 'center',
  paddingVertical: '$m',
  paddingHorizontal: '$s',
  pressStyle: {
    backgroundColor: '$secondaryBackground',
  },
});

const TabBarCreateButton = styled(Button, {
  flex: 0,
  aspectRatio: 1,
  borderWidth: 1,
  borderColor: '$border',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '$xxxl',
  padding: '$m',
});
