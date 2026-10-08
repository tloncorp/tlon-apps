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
import { getTokenValue, useTheme } from 'tamagui';

import { useIsDarkMode } from '../../hooks/useDarkMode';

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

const contentHorizontalInset = 8;
const groupGap = 24;
const groupTitleGap = 8;
const rowMinHeight = 72;
const actionGroupShape = Shapes.RoundedCorner(16);
const actionGroupInnerShape = Shapes.RoundedCorner(15);

/** Expo UI's native Compose sheet shell for Android. */
export function ExpoUISheet({
  open,
  onOpenChange,
  onDismiss,
  children,
}: ExpoUISheetProps) {
  const theme = useTheme();
  const isDarkMode = useIsDarkMode();
  const sheetRef = useRef<ModalBottomSheetRef>(null);
  const [mounted, setMounted] = useState(open);
  const [mountKey, setMountKey] = useState(0);
  const openRef = useRef(open);
  const mountedRef = useRef(open);
  const hidingRef = useRef(false);
  const operationRef = useRef(0);
  const mountKeyRef = useRef(0);
  const onDismissRef = useRef(onDismiss);
  const onOpenChangeRef = useRef(onOpenChange);
  onDismissRef.current = onDismiss;
  onOpenChangeRef.current = onOpenChange;

  useEffect(() => {
    const operation = ++operationRef.current;
    openRef.current = open;

    if (open) {
      if (hidingRef.current) {
        hidingRef.current = false;
        const nextKey = mountKeyRef.current + 1;
        mountKeyRef.current = nextKey;
        setMountKey(nextKey);
      }
      if (!mountedRef.current) {
        mountedRef.current = true;
        setMounted(true);
      }
      triggerHaptic('sheetOpen');
      return () => {
        if (operationRef.current === operation) {
          operationRef.current += 1;
        }
      };
    }

    if (mountedRef.current) {
      hidingRef.current = true;
      const dismiss = async () => {
        await sheetRef.current?.hide();
        if (
          operationRef.current === operation &&
          !openRef.current &&
          hidingRef.current
        ) {
          hidingRef.current = false;
          mountedRef.current = false;
          setMounted(false);
          onDismissRef.current?.();
        }
      };
      void dismiss();
    }

    return () => {
      if (operationRef.current === operation) {
        operationRef.current += 1;
      }
    };
  }, [open]);

  const handleDismissRequest = useCallback((dismissedKey: number) => {
    if (dismissedKey !== mountKeyRef.current) return;
    operationRef.current += 1;
    hidingRef.current = false;
    mountedRef.current = false;
    setMounted(false);
    if (openRef.current) {
      onOpenChangeRef.current(false);
    }
    onDismissRef.current?.();
  }, []);

  return (
    <Host
      matchContents
      colorScheme={isDarkMode ? 'dark' : 'light'}
      style={{ position: 'absolute' }}
    >
      {mounted ? (
        <ModalBottomSheet
          key={mountKey}
          ref={sheetRef}
          onDismissRequest={() => handleDismissRequest(mountKey)}
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
export function ExpoUIPaneStack({
  selected,
  initial,
  notifications,
  sort,
}: ExpoUIPaneStackProps) {
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
  rounded = false,
}: {
  icon: React.ReactElement;
  size?: number;
  rounded?: boolean;
}) {
  return (
    <RNHostView matchContents>
      <View
        style={{
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
          // Clip the actual slot, not the larger avatar inside the native host.
          ...(rounded
            ? {
                borderRadius: getTokenValue('$s', 'radius'),
                overflow: 'hidden' as const,
              }
            : {}),
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
  const { isDisabled, titleColor, descriptionColor, iconColor, rowBackground } =
    getActionRowStyle(theme, action, groupAccent);
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
export function ExpoUIActionContent({
  title,
  subtitle,
  icon,
  onBack,
  actionGroups,
}: ExpoUIActionContentProps) {
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
        {icon ? <HostedIcon icon={icon} rounded={!onBack} /> : null}
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
            verticalArrangement={{ spacedBy: groupTitleGap }}
            modifiers={[fillMaxWidth()]}
          >
            {group.title ? (
              <Text
                color={theme.secondaryText.val}
                style={{ fontSize: 14, fontWeight: '400', lineHeight: 20 }}
                modifiers={[padding(24, 0, 24, 0)]}
              >
                {group.title}
              </Text>
            ) : null}
            <Column
              modifiers={[
                fillMaxWidth(),
                clip(actionGroupShape),
                background(getActionGroupBorderColor(theme, group.accent)),
                padding(1, 1, 1, 1),
              ]}
            >
              {/* An inset rounded fill draws a continuous 1dp border using stock Expo UI. */}
              <Column
                modifiers={[
                  fillMaxWidth(),
                  clip(actionGroupInnerShape),
                  background(theme.background.val),
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
            </Column>
          </Column>
        ))}
      </Column>
    </Column>
  );
}
