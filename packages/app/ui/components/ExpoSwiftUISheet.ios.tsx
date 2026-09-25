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
  presentationDragIndicator,
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
import { useTheme } from 'tamagui';

import type { Action, ActionGroup } from './ActionSheet';
import type {
  ExpoSwiftUIActionContentProps,
  ExpoSwiftUIPaneStackProps,
  ExpoSwiftUISheetProps,
} from './ExpoSwiftUISheet.types';

const ContentHeightContext = createContext<(height: number) => void>(() => {});
const SheetHeightContext = createContext(420);
const platformColor = PlatformColor;
const contentTopInset = 36;
const contentHorizontalInset = 8;
const headerLeadingInset = 24;
const headerTrailingInset = 10;
const headerActionGap = 36;
const groupGap = 32;
const rowContentHeight = 48;
const rowHorizontalInset = 24;
const rowVerticalInset = 12;
const paneAnimationDuration = 0.28;
const sheetHeightAnimationDuration = 0.4;
const ignoreHeight = () => {};

/** A native SwiftUI sheet shell; unlike the drop-in Expo sheet, its content is native too. */
export function ExpoSwiftUISheet({
  open,
  onOpenChange,
  onDismiss,
  children,
}: ExpoSwiftUISheetProps) {
  const { width, height } = useWindowDimensions();
  const startingHeight = Math.min(420, height * 0.78);
  const [sheetHeightState, setSheetHeightState] = useState(() => ({
    contentHeight: 420,
    frameHeight: startingHeight,
    targetHeight: startingHeight,
    selectedHeight: startingHeight,
  }));
  const sheetHeightStateRef = useRef(sheetHeightState);
  const heightSelectionTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const close = useCallback(() => onOpenChange(false), [onOpenChange]);
  const updateContentHeight = useCallback(
    (nextHeight: number) => {
      if (!Number.isFinite(nextHeight) || nextHeight <= 0) return;
      const roundedHeight = Math.ceil(nextHeight);
      const targetHeight =
        Math.round(
          Math.min(Math.max(roundedHeight, 240), height * 0.78, 800) / 4
        ) * 4;

      const previous = sheetHeightStateRef.current;
      const contentChanged =
        Math.abs(previous.contentHeight - roundedHeight) > 4;
      const selectionChanged =
        Math.abs(previous.targetHeight - targetHeight) > 1;
      if (!contentChanged && !selectionChanged) return;

      if (selectionChanged) {
        if (heightSelectionTimeoutRef.current !== null) {
          clearTimeout(heightSelectionTimeoutRef.current);
          heightSelectionTimeoutRef.current = null;
        }
      }
      const stagedState = {
        contentHeight: roundedHeight,
        // Stage the native pager at the largest measured pane so its timed
        // update can animate in sync with the selected sheet detent.
        frameHeight: Math.max(previous.frameHeight, targetHeight),
        targetHeight,
        selectedHeight: previous.selectedHeight,
      };
      sheetHeightStateRef.current = stagedState;
      setSheetHeightState(stagedState);

      if (!selectionChanged) return;

      heightSelectionTimeoutRef.current = setTimeout(() => {
        const current = sheetHeightStateRef.current;
        if (Math.abs(current.targetHeight - targetHeight) > 1) return;
        const animatedState = {
          ...current,
          frameHeight: targetHeight,
          selectedHeight: targetHeight,
        };
        sheetHeightStateRef.current = animatedState;
        setSheetHeightState(animatedState);
        heightSelectionTimeoutRef.current = null;
      }, 50);
    },
    [height]
  );
  const { frameHeight, selectedHeight } = sheetHeightState;

  useEffect(() => {
    if (open) triggerHaptic('sheetOpen');
  }, [open]);

  useEffect(
    () => () => {
      if (heightSelectionTimeoutRef.current !== null) {
        clearTimeout(heightSelectionTimeoutRef.current);
      }
    },
    []
  );

  return (
    <ContentHeightContext.Provider value={updateContentHeight}>
      <SheetHeightContext.Provider value={frameHeight}>
        <Host style={{ position: 'absolute', width }} pointerEvents="none">
          <BottomSheet
            isPresented={open}
            detents={[{ height: 240 }, 'large']}
            selectedDetent={{ height: selectedHeight }}
            animateSelectedDetentChanges
            detentAnimationDuration={sheetHeightAnimationDuration}
            onDismiss={onDismiss}
            onIsPresentedChange={(presented) => {
              if (!presented) close();
            }}
          >
            <Group modifiers={[presentationDragIndicator('hidden')]}>
              {children}
            </Group>
          </BottomSheet>
        </Host>
      </SheetHeightContext.Provider>
    </ContentHeightContext.Provider>
  );
}

/** A native root/detail pager inside the existing sheet. */
export function ExpoSwiftUIPaneStack({
  selected,
  onSelectionChange,
  initial,
  notifications,
  sort,
}: ExpoSwiftUIPaneStackProps) {
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
          Animation.easeInOut({ duration: paneAnimationDuration }),
          selectedTab === 'detail' ? 1 : 0
        ),
        animation(
          Animation.easeInOut({ duration: sheetHeightAnimationDuration }),
          sheetHeight
        ),
      ]}
    >
      <TabView.Tab value="initial">
        <ContentHeightContext.Provider
          value={selected === 'initial' ? updateContentHeight : ignoreHeight}
        >
          {initial}
        </ContentHeightContext.Provider>
      </TabView.Tab>
      <TabView.Tab value="detail">
        <ContentHeightContext.Provider
          value={selected === 'initial' ? ignoreHeight : updateContentHeight}
        >
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
  const accent = action.accent ?? groupAccent;
  const isDisabled =
    action.disabled ||
    action.accent === 'disabled' ||
    groupAccent === 'disabled';
  const isDestructive = accent === 'negative';
  const titleColor =
    accent === 'positive'
      ? theme.positiveActionText.val
      : accent === 'negative'
        ? theme.negativeActionText.val
        : accent === 'disabled'
          ? theme.tertiaryText.val
          : theme.primaryText.val;
  const descriptionColor =
    accent === 'positive'
      ? theme.positiveActionText.val
      : accent === 'negative'
        ? theme.negativeActionText.val
        : theme.tertiaryText.val;
  const iconColor =
    accent === 'positive'
      ? ('$positiveActionText' as const)
      : accent === 'negative'
        ? ('$negativeActionText' as const)
        : accent === 'disabled'
          ? ('$tertiaryText' as const)
          : ('$primaryText' as const);
  const rowBackground = action.selected
    ? theme.positiveBackground.val
    : accent === 'positive'
      ? theme.positiveBackground.val
      : accent === 'negative'
        ? theme.negativeBackground.val
        : undefined;

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

/** Native header and grouped actions for the chat-options pilot. */
export function ExpoSwiftUIActionContent({
  title,
  subtitle,
  icon,
  onBack,
  actionGroups,
}: ExpoSwiftUIActionContentProps) {
  const theme = useTheme();
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
    // Header + outer padding + group spacing + minimum row heights.
    return (
      contentTopInset +
      40 +
      headerActionGap +
      12 +
      8 +
      rowCount * (rowContentHeight + rowVerticalInset * 2) +
      dividerCount +
      (visibleGroups.length - 1) * groupGap
    );
  }, [visibleGroups]);

  useLayoutEffect(() => {
    updateContentHeight(estimatedHeight);
  }, [estimatedHeight, updateContentHeight]);

  return (
    <ScrollView showsIndicators={false}>
      <VStack
        spacing={headerActionGap}
        modifiers={[
          frame({ maxWidth: Infinity, alignment: 'leading' }),
          padding({
            top: contentTopInset,
            bottom: 12,
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
              spacing={0}
              modifiers={[
                background(
                  platformColor('secondarySystemBackground'),
                  shapes.roundedRectangle({ cornerRadius: 16 })
                ),
                clipShape('roundedRectangle', 16),
                strokeBorder({
                  color:
                    group.accent === 'positive'
                      ? theme.positiveBorder.val
                      : group.accent === 'negative'
                        ? theme.negativeBorder.val
                        : group.accent === 'disabled'
                          ? theme.secondaryBorder.val
                          : theme.border.val,
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
          ))}
        </VStack>
      </VStack>
    </ScrollView>
  );
}
