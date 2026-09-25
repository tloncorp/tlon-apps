import {
  Column,
  HorizontalDivider,
  Host,
  ModalBottomSheet,
  RNHostView,
  Row,
  Text,
} from '@expo/ui/jetpack-compose';
import type { ModalBottomSheetRef } from '@expo/ui/jetpack-compose';
import {
  Shapes,
  animateContentSize,
  background,
  border,
  clickable,
  clip,
  defaultMinSize,
  fillMaxWidth,
  padding,
  testID,
  verticalScroll,
  weight,
} from '@expo/ui/jetpack-compose/modifiers';
import { Icon, triggerHaptic } from '@tloncorp/ui';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { View } from 'react-native';
import { useTheme } from 'tamagui';

import type { Action, ActionGroup } from './ActionSheet';
import type {
  ExpoSwiftUIActionContentProps,
  ExpoSwiftUIPaneStackProps,
  ExpoSwiftUISheetProps,
} from './ExpoSwiftUISheet.types';

const contentHorizontalInset = 8;
const groupGap = 24;
const rowMinHeight = 72;

/** Expo UI's native Compose sheet shell for Android. */
export function ExpoSwiftUISheet({
  open,
  onOpenChange,
  onDismiss,
  children,
}: ExpoSwiftUISheetProps) {
  const theme = useTheme();
  const sheetRef = useRef<ModalBottomSheetRef>(null);
  const [mounted, setMounted] = useState(open);
  const openRef = useRef(open);

  useEffect(() => {
    openRef.current = open;
    if (open) {
      setMounted(true);
      triggerHaptic('sheetOpen');
      return;
    }

    if (mounted) {
      let cancelled = false;
      const dismiss = async () => {
        await sheetRef.current?.hide();
        if (!cancelled) {
          setMounted(false);
          onDismiss?.();
        }
      };
      void dismiss();
      return () => {
        cancelled = true;
      };
    }
  }, [mounted, onDismiss, open]);

  const handleDismissRequest = useCallback(() => {
    setMounted(false);
    if (openRef.current) {
      onOpenChange(false);
    }
    onDismiss?.();
  }, [onDismiss, onOpenChange]);

  return (
    <Host matchContents style={{ position: 'absolute' }}>
      {mounted ? (
        <ModalBottomSheet
          ref={sheetRef}
          onDismissRequest={handleDismissRequest}
          containerColor={theme.background.val}
          contentColor={theme.primaryText.val}
          initialFullyExpanded
          showDragHandle
        >
          {children}
        </ModalBottomSheet>
      ) : null}
    </Host>
  );
}

/** Native root/detail content whose height follows Compose's spring animation. */
export function ExpoSwiftUIPaneStack({
  selected,
  initial,
  notifications,
  sort,
}: ExpoSwiftUIPaneStackProps) {
  const content =
    selected === 'initial'
      ? initial
      : selected === 'sort' && sort
        ? sort
        : notifications;

  return (
    <Column modifiers={[fillMaxWidth(), animateContentSize()]}>
      {content}
    </Column>
  );
}

function HostedIcon({
  icon,
  size = 40,
}: {
  icon: React.ReactElement;
  size?: number;
}) {
  return (
    <RNHostView matchContents>
      <View
        style={{
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </View>
    </RNHostView>
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
  const modifiers = [
    fillMaxWidth(),
    defaultMinSize({ minHeight: rowMinHeight }),
    ...(rowBackground ? [background(rowBackground)] : []),
    ...(!isDisabled && action.action ? [clickable(action.action)] : []),
    ...(action.testID ? [testID(action.testID)] : []),
    padding(24, 12, 24, 12),
  ];

  return (
    <Row
      verticalAlignment="center"
      horizontalArrangement={{ spacedBy: 12 }}
      modifiers={modifiers}
    >
      {action.startIcon ? (
        <HostedIcon
          size={24}
          icon={
            typeof action.startIcon === 'string' ? (
              <Icon type={action.startIcon} size="$m" color={iconColor} />
            ) : (
              action.startIcon
            )
          }
        />
      ) : null}
      <Column verticalArrangement={{ spacedBy: 2 }} modifiers={[weight(1)]}>
        <Text
          color={titleColor}
          style={{ fontSize: 16, fontWeight: '400', lineHeight: 22 }}
        >
          {action.title}
        </Text>
        {action.description ? (
          <Text
            color={descriptionColor}
            style={{ fontSize: 14, fontWeight: '400', lineHeight: 20 }}
          >
            {action.description}
          </Text>
        ) : null}
      </Column>
      {action.endIcon ? (
        <HostedIcon
          size={24}
          icon={
            typeof action.endIcon === 'string' ? (
              <Icon type={action.endIcon} size="$m" color={iconColor} />
            ) : (
              action.endIcon
            )
          }
        />
      ) : null}
    </Row>
  );
}

/** Native Material 3 header and grouped actions for chat options. */
export function ExpoSwiftUIActionContent({
  title,
  subtitle,
  icon,
  actionGroups,
}: ExpoSwiftUIActionContentProps) {
  const theme = useTheme();
  const visibleGroups = useMemo(
    () => actionGroups.filter((group) => group.actions.length > 0),
    [actionGroups]
  );

  return (
    <Column
      verticalArrangement={{ spacedBy: 32 }}
      modifiers={[
        fillMaxWidth(),
        verticalScroll(),
        animateContentSize(),
        padding(contentHorizontalInset, 12, contentHorizontalInset, 20),
      ]}
    >
      <Row
        verticalAlignment="center"
        horizontalArrangement={{ spacedBy: 20 }}
        modifiers={[fillMaxWidth(), padding(16, 0, 8, 0)]}
      >
        {icon ? <HostedIcon icon={icon} /> : null}
        <Column
          verticalArrangement={{ spacedBy: 2 }}
          modifiers={[weight(1), defaultMinSize({ minHeight: 40 })]}
        >
          <Text
            color={theme.primaryText.val}
            maxLines={1}
            overflow="ellipsis"
            style={{
              fontSize: 17,
              fontWeight: '500',
              lineHeight: 24,
              letterSpacing: -0.2,
            }}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              color={theme.secondaryText.val}
              maxLines={1}
              overflow="ellipsis"
              style={{ fontSize: 14, fontWeight: '400', lineHeight: 20 }}
            >
              {subtitle}
            </Text>
          ) : null}
        </Column>
      </Row>

      <Column verticalArrangement={{ spacedBy: groupGap }}>
        {visibleGroups.map((group, groupIndex) => (
          <Column
            key={groupIndex}
            modifiers={[
              fillMaxWidth(),
              clip(Shapes.RoundedCorner(16)),
              background(theme.secondaryBackground.val),
              border(
                1,
                group.accent === 'positive'
                  ? theme.positiveBorder.val
                  : group.accent === 'negative'
                    ? theme.negativeBorder.val
                    : group.accent === 'disabled'
                      ? theme.secondaryBorder.val
                      : theme.border.val
              ),
            ]}
          >
            {group.actions.map((action, actionIndex) => (
              <React.Fragment key={`${action.title}-${actionIndex}`}>
                {actionIndex > 0 ? (
                  <HorizontalDivider
                    color={theme.secondaryBorder.val}
                    thickness={1}
                  />
                ) : null}
                <ActionRow action={action} groupAccent={group.accent} />
              </React.Fragment>
            ))}
          </Column>
        ))}
      </Column>
    </Column>
  );
}
