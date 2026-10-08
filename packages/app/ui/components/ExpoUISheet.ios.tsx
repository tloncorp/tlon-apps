import {
  BottomSheet,
  Button,
  Divider,
  Group,
  HStack,
  Host,
  Image,
  RNHostView,
  ScrollView,
  Spacer,
  TabView,
  Text,
  VStack,
} from '@expo/ui/swift-ui';
import {
  accessibilityIdentifier,
  animation,
  Animation,
  background,
  buttonStyle,
  clipShape,
  contentShape,
  disabled,
  font,
  foregroundStyle,
  frame,
  kerning,
  lineHeight,
  lineLimit,
  onGeometryChange,
  padding,
  presentationBackground,
  presentationDetents,
  presentationDragIndicator,
  scrollDisabled,
  shapes,
  strokeBorder,
  tabViewStyle,
} from '@expo/ui/swift-ui/modifiers';
import { Icon, triggerHaptic } from '@tloncorp/ui';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { PlatformColor, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from 'tamagui';

import type { Action, ActionGroup } from './ActionSheet';
import {
  getActionGroupBorderColor,
  getActionRowStyle,
} from './ExpoUISheet.shared';
import type {
  ExpoUIActionContentProps,
  ExpoUIPaneStackProps,
  ExpoUISheetProps,
} from './ExpoUISheet.types';

const ContentHeightContext = createContext<(height: number) => void>(() => {});
const SheetHeightContext = createContext(420);
const SheetExpandedContext = createContext(false);
const platformColor = PlatformColor;
const contentTopInset = 36;
const contentHorizontalInset = 8;
const headerLeadingInset = 24;
// Keep long titles clear of the native 44-point close control and its trailing gap.
const headerTrailingInset = 64;
const headerActionGap = 36;
const groupGap = 32;
const groupTitleHeight = 20;
const groupTitleGap = 8;
const rowContentHeight = 48;
const rowHorizontalInset = 24;
const rowVerticalInset = 12;
const paneAnimationDuration = 0.17;
const ignoreHeight = () => {};

/** A native SwiftUI sheet shell; unlike the drop-in Expo sheet, its content is native too. */
export function ExpoUISheet({
  open,
  onOpenChange,
  onDismiss,
  children,
}: ExpoUISheetProps) {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const [isExpanded, setIsExpanded] = useState(false);
  const [contentHeight, setContentHeight] = useState(420);
  const close = useCallback(() => onOpenChange(false), [onOpenChange]);
  const updateContentHeight = useCallback((nextHeight: number) => {
    if (!Number.isFinite(nextHeight) || nextHeight <= 0) return;
    const roundedHeight = Math.ceil(nextHeight);
    setContentHeight((previous) =>
      Math.abs(previous - roundedHeight) > 4 ? roundedHeight : previous
    );
  }, []);
  const initialHeight = Math.min(
    Math.max(contentHeight, 240),
    height * 0.78,
    800
  );

  useEffect(() => {
    if (open) triggerHaptic('sheetOpen');
    else setIsExpanded(false);
  }, [open]);

  return (
    <ContentHeightContext.Provider value={updateContentHeight}>
      <SheetHeightContext.Provider value={initialHeight}>
        <SheetExpandedContext.Provider value={isExpanded}>
          <Host style={{ position: 'absolute', width }} pointerEvents="none">
            <BottomSheet
              isPresented={open}
              onDismiss={onDismiss}
              onIsPresentedChange={(presented) => {
                if (!presented) {
                  setIsExpanded(false);
                  close();
                }
              }}
            >
              <Group
                modifiers={[
                  presentationDetents([{ height: initialHeight }, 'large'], {
                    // Observe native expansion without driving its selection from JS.
                    onSelectionChange: (detent) => {
                      setIsExpanded(detent === 'large');
                    },
                  }),
                  presentationDragIndicator('hidden'),
                  presentationBackground(theme.background.val),
                ]}
              >
                {children}
              </Group>
            </BottomSheet>
          </Host>
        </SheetExpandedContext.Provider>
      </SheetHeightContext.Provider>
    </ContentHeightContext.Provider>
  );
}

/** A native root/detail pager inside the existing sheet. */
export function ExpoUIPaneStack({
  selected,
  onSelectionChange,
  initial,
  notifications,
  sort,
}: ExpoUIPaneStackProps) {
  const sheetHeight = useContext(SheetHeightContext);
  const updateContentHeight = useContext(ContentHeightContext);
  const selectedTab = selected === 'initial' ? 'initial' : 'detail';
  const detailSelectionRef = useRef<'notifications' | 'sort'>(
    selected === 'sort' ? 'sort' : 'notifications'
  );
  if (selected !== 'initial') {
    detailSelectionRef.current = selected;
  }
  const detail =
    detailSelectionRef.current === 'sort' && sort ? sort : notifications;

  return (
    <TabView
      selection={selectedTab}
      onSelectionChange={(next) => {
        if (next === 'initial') {
          onSelectionChange('initial');
        } else if (next === 'detail') {
          onSelectionChange(detailSelectionRef.current);
        }
      }}
      modifiers={[
        tabViewStyle({ type: 'page', indexDisplayMode: 'never' }),
        frame({
          minHeight: sheetHeight,
          maxWidth: Infinity,
          maxHeight: Infinity,
        }),
        animation(
          Animation.easeOut({ duration: paneAnimationDuration }),
          selectedTab === 'detail' ? 1 : 0
        ),
      ]}
    >
      <TabView.Tab value="initial">
        {/* Keep one stable height owner across navigation. Detail panes must not
            resize the sheet or interrupt a native expand/collapse gesture. */}
        <ContentHeightContext.Provider value={updateContentHeight}>
          {initial}
        </ContentHeightContext.Provider>
      </TabView.Tab>
      <TabView.Tab value="detail">
        <ContentHeightContext.Provider value={ignoreHeight}>
          {detail}
        </ContentHeightContext.Provider>
      </TabView.Tab>
    </TabView>
  );
}

function ActionRow({
  action,
  groupAccent,
}: {
  action: Action;
  groupAccent: ActionGroup['accent'];
}) {
  const theme = useTheme();
  const {
    accent,
    isDisabled,
    titleColor,
    descriptionColor,
    iconColor,
    rowBackground,
  } = getActionRowStyle(theme, action, groupAccent);
  const isDestructive = accent === 'negative';

  return (
    <Button
      onPress={action.action}
      role={isDestructive ? 'destructive' : 'default'}
      modifiers={[
        buttonStyle('plain'),
        disabled(!!isDisabled),
        ...(action.testID ? [accessibilityIdentifier(action.testID)] : []),
      ]}
    >
      <HStack
        spacing={12}
        modifiers={[
          frame({ minHeight: rowContentHeight, maxWidth: Infinity }),
          padding({
            horizontal: rowHorizontalInset,
            vertical: rowVerticalInset,
          }),
          ...(rowBackground
            ? [background(rowBackground, shapes.rectangle())]
            : []),
          // Plain SwiftUI buttons only hit-test their visible label by default.
          // Include the spacer and row padding in the tappable area.
          contentShape(shapes.rectangle()),
        ]}
      >
        {action.startIcon ? (
          <RNHostView matchContents>
            {typeof action.startIcon === 'string' ? (
              <Icon type={action.startIcon} size="$m" color={iconColor} />
            ) : (
              action.startIcon
            )}
          </RNHostView>
        ) : null}
        <VStack
          alignment="leading"
          spacing={2}
          modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
        >
          <Text
            modifiers={[
              font({ size: 16, weight: 'regular' }),
              foregroundStyle(titleColor),
            ]}
          >
            {action.title}
          </Text>
          {action.description ? (
            <Text
              modifiers={[
                font({ size: 14, weight: 'regular' }),
                foregroundStyle(descriptionColor),
              ]}
            >
              {action.description}
            </Text>
          ) : null}
        </VStack>
        <Spacer />
        {action.endIcon ? (
          <RNHostView matchContents>
            {typeof action.endIcon === 'string' ? (
              <Icon type={action.endIcon} size="$m" color={iconColor} />
            ) : (
              action.endIcon
            )}
          </RNHostView>
        ) : null}
      </HStack>
    </Button>
  );
}

/** Native header and grouped actions for chat options. */
export function ExpoUIActionContent({
  title,
  subtitle,
  icon,
  onBack,
  actionGroups,
}: ExpoUIActionContentProps) {
  const theme = useTheme();
  const { bottom } = useSafeAreaInsets();
  const isSheetExpanded = useContext(SheetExpandedContext);
  const updateContentHeight = useContext(ContentHeightContext);
  const visibleGroups = useMemo(
    () => actionGroups.filter((group) => group.actions.length > 0),
    [actionGroups]
  );
  const estimatedHeight = useMemo(() => {
    const rowCount = visibleGroups.reduce(
      (count, group) => count + group.actions.length,
      0
    );
    const dividerCount = rowCount - visibleGroups.length;
    const titleCount = visibleGroups.filter((group) => group.title).length;
    // Header + outer padding + group spacing + titles + minimum row heights.
    return (
      contentTopInset +
      40 +
      headerActionGap +
      Math.max(12, bottom) +
      8 +
      rowCount * (rowContentHeight + rowVerticalInset * 2) +
      dividerCount +
      titleCount * (groupTitleHeight + groupTitleGap) +
      (visibleGroups.length - 1) * groupGap
    );
  }, [bottom, visibleGroups]);

  useLayoutEffect(() => {
    updateContentHeight(estimatedHeight);
  }, [estimatedHeight, updateContentHeight]);

  return (
    <ScrollView
      showsIndicators={false}
      modifiers={[scrollDisabled(!isSheetExpanded)]}
    >
      <VStack
        spacing={headerActionGap}
        modifiers={[
          frame({ maxWidth: Infinity, alignment: 'leading' }),
          padding({
            top: contentTopInset,
            bottom: Math.max(12, bottom),
            horizontal: contentHorizontalInset,
          }),
          onGeometryChange(({ height }) => updateContentHeight(height + 8)),
        ]}
      >
        <HStack
          alignment="center"
          spacing={20}
          modifiers={[
            padding({
              leading: headerLeadingInset,
              trailing: headerTrailingInset,
            }),
          ]}
        >
          {onBack ? (
            <Button
              onPress={onBack}
              modifiers={[
                buttonStyle('plain'),
                accessibilityIdentifier('SheetBackButton'),
              ]}
            >
              <Image
                systemName="chevron.left"
                size={18}
                color={platformColor('label')}
              />
            </Button>
          ) : icon ? (
            <RNHostView matchContents>
              <View
                style={{
                  width: 40,
                  height: 40,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {icon}
              </View>
            </RNHostView>
          ) : null}
          <VStack
            alignment="leading"
            spacing={2}
            modifiers={[
              frame({
                minHeight: 40,
                maxWidth: Infinity,
                alignment: 'leading',
              }),
            ]}
          >
            <Text
              modifiers={[
                font({ size: 17, weight: 'medium' }),
                lineHeight(24),
                kerning(-0.2),
                lineLimit(1),
              ]}
            >
              {title}
            </Text>
            {subtitle ? (
              <Text
                modifiers={[
                  font({ size: 14, weight: 'regular' }),
                  lineLimit(1),
                  foregroundStyle({
                    type: 'hierarchical',
                    style: 'secondary',
                  }),
                ]}
              >
                {subtitle}
              </Text>
            ) : null}
          </VStack>
          <Spacer />
        </HStack>
        <VStack spacing={groupGap}>
          {visibleGroups.map((group, groupIndex) => (
            <VStack
              key={groupIndex}
              alignment="leading"
              spacing={groupTitleGap}
            >
              {group.title ? (
                <Text
                  modifiers={[
                    font({ size: 14, weight: 'regular' }),
                    lineHeight(groupTitleHeight),
                    foregroundStyle(theme.secondaryText.val),
                    padding({ horizontal: rowHorizontalInset }),
                  ]}
                >
                  {group.title}
                </Text>
              ) : null}
              <VStack
                spacing={0}
                modifiers={[
                  background(
                    theme.background.val,
                    shapes.roundedRectangle({ cornerRadius: 16 })
                  ),
                  clipShape('roundedRectangle', 16),
                  strokeBorder({
                    color: getActionGroupBorderColor(theme, group.accent),
                    style: { lineWidth: 1 },
                    shape: 'roundedRectangle',
                    cornerRadius: 16,
                  }),
                ]}
              >
                {group.actions.map((action, actionIndex) => (
                  <Group key={`${action.title}-${actionIndex}`}>
                    {actionIndex > 0 ? (
                      <Divider
                        modifiers={[
                          background(
                            theme.secondaryBorder.val,
                            shapes.rectangle()
                          ),
                        ]}
                      />
                    ) : null}
                    <ActionRow action={action} groupAccent={group.accent} />
                  </Group>
                ))}
              </VStack>
            </VStack>
          ))}
        </VStack>
      </VStack>
    </ScrollView>
  );
}
