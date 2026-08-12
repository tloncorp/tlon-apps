import { A2UI, type A2UIBlockData } from '@tloncorp/shared/logic';
import { useGroup } from '@tloncorp/shared/store';
import { Button, Icon, Pressable, Text } from '@tloncorp/ui';
import React, {
  ComponentProps,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Input, View, XStack, YStack } from 'tamagui';

import { InviteFriendsToTlonButton } from '../InviteFriendsToTlonButton';
import { useContentContext } from './contentUtils';

type RenderOptions = {
  cardDepth?: number;
  parentAlign?: A2UI.Container['align'];
};

/**
 * Accent pairs for Choice option icons: a soft tile behind the icon in its
 * saturated colour, matching the design's choice cards.
 */
const CHOICE_ACCENT_COLORS: Record<
  NonNullable<A2UI.ChoiceOption['accent']>,
  {
    soft: ComponentProps<typeof View>['backgroundColor'];
    strong: ComponentProps<typeof Icon>['color'];
  }
> = {
  blue: { soft: '$blueSoft', strong: '$blue' },
  green: { soft: '$greenSoft', strong: '$green' },
  indigo: { soft: '$indigoSoft', strong: '$indigo' },
  neutral: { soft: '$secondaryBackground', strong: '$secondaryText' },
};

/**
 * A wrapping list of pills the user can multi-select, plus the submit that
 * posts the selection as one message. Selection is local until submit — no
 * per-tap posting — so it lives in a child component with its own state
 * rather than in the render callback.
 */
function SmallChoicePills({
  component,
  canSend,
  isActionAvailable,
  onSubmit,
}: {
  component: A2UI.SmallChoice;
  /** false when there is no action handler at all */
  canSend: boolean;
  isActionAvailable?: (action: A2UI.ButtonAction) => boolean;
  onSubmit: (text: string) => void | Promise<void>;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [freeText, setFreeText] = useState('');
  // In-flight only: block a double tap while transport is sending, then allow
  // retry. Transport success is not coordinator acknowledgement; the monitor
  // may have missed a message during a restart or unreadable-group window.
  const [submitted, setSubmitted] = useState(false);
  const submittingRef = useRef(false);

  const toggle = useCallback((id: string) => {
    setSelectedIds((previous) =>
      previous.includes(id)
        ? previous.filter((selected) => selected !== id)
        : [...previous, id]
    );
  }, []);

  const messageForSelection = A2UI.buildSmallChoiceMessage(
    component,
    selectedIds,
    freeText
  );

  const handleSubmit = useCallback(async () => {
    if (!messageForSelection || submittingRef.current) {
      return;
    }
    // Disable first so a double tap can't send twice, but put it back if
    // the send fails: the picker is the only way to answer the setup, and
    // a card disabled over a message that never posted leaves the owner
    // looking at their own selection with nothing to do about it.
    submittingRef.current = true;
    setSubmitted(true);
    try {
      await onSubmit(messageForSelection);
    } catch {
      // The transport reports failures elsewhere; this surface only needs to
      // become available again so the owner can retry.
    } finally {
      submittingRef.current = false;
      setSubmitted(false);
    }
  }, [messageForSelection, onSubmit]);

  /**
   * Availability has to be judged against the message that would actually be
   * sent, not against `component.action`: for a SmallChoice that action's text
   * is only a prefix and is usually empty, which an availability check written
   * for Button (where the text *is* the whole message) reads as "nothing to
   * send" and disables the whole picker.
   *
   * So probe with every option selected — always non-empty — to decide whether
   * the surface can send at all, and check the real selection for the submit.
   */
  const probe = (text: string): boolean =>
    canSend &&
    isActionAvailable?.({
      event: { name: A2UI.action.sendMessage, context: { text } },
    }) !== false;

  const disabled = submitted || !probe(A2UI.smallChoiceProbeMessage(component));
  const submitDisabled =
    disabled || !messageForSelection || !probe(messageForSelection);

  return (
    <YStack gap="$m" width="100%" marginTop={CONTROL_GROUP_TOP_MARGIN}>
      <XStack flexWrap="wrap" gap="$s" width="100%">
        {component.options.map((option) => {
          const isSelected = selectedIds.includes(option.id);
          // Selected inverts the pill instead of tinting it, so a chosen
          // topic reads at a glance across a wrapped row. Hoisted out of the
          // JSX: an inline ternary on these props gets dropped by Tamagui's
          // compiler, leaving the pill unstyled.
          const pillEdge = isSelected ? '$primaryText' : '$border';
          const pillFill = isSelected ? '$primaryText' : '$background';
          const pillLabel = isSelected ? '$background' : '$primaryText';
          return (
            <Pressable
              key={option.id}
              testID={`A2UISmallChoice-${option.id}`}
              accessibilityLabel={option.label}
              accessibilityState={{ selected: isSelected }}
              disabled={disabled}
              onPress={disabled ? undefined : () => toggle(option.id)}
            >
              <XStack
                borderWidth={1}
                borderColor={pillEdge}
                backgroundColor={pillFill}
                borderRadius="$2xl"
                paddingVertical="$s"
                paddingHorizontal="$l"
                opacity={disabled ? 0.5 : 1}
              >
                <Text size="$label/m" color={pillLabel} trimmed={false}>
                  {option.label}
                </Text>
              </XStack>
            </Pressable>
          );
        })}
      </XStack>
      {component.freeTextPlaceholder ? (
        // Typed additions ride along with the pills: "some of these plus one
        // of my own" is one submit, not a pill message chased by a text one.
        <Input
          testID="A2UISmallChoiceFreeText"
          value={freeText}
          onChangeText={setFreeText}
          maxLength={1000}
          placeholder={component.freeTextPlaceholder}
          placeholderTextColor="$tertiaryText"
          disabled={disabled}
          borderColor="$border"
          borderWidth={1}
          borderRadius="$l"
          paddingHorizontal="$l"
          height={44}
          width="100%"
          onSubmitEditing={submitDisabled ? undefined : handleSubmit}
        />
      ) : null}
      <Button.Frame
        size="medium"
        fill="solid"
        intent="positive"
        alignSelf="flex-start"
        height={44}
        paddingHorizontal="$xl"
        testID="A2UISmallChoiceSubmit"
        disabled={submitDisabled}
        dimmed={submitDisabled}
        onPress={submitDisabled ? undefined : handleSubmit}
      >
        <Button.Text size="medium">{component.submitLabel}</Button.Text>
      </Button.Frame>
    </YStack>
  );
}

function getTextSize(component: A2UI.Text) {
  switch (component.variant) {
    case 'h1':
      return '$title/l';
    case 'h2':
      return '$label/xl';
    case 'h3':
      return '$label/xl';
    case 'caption':
      return '$label/m';
    default:
      return '$body';
  }
}

function getTextColor(component: A2UI.Text) {
  return component.variant === 'caption' ? '$secondaryText' : '$primaryText';
}

function getComponentGap(
  component: A2UI.Container,
  components: Map<string, A2UI.Component>
) {
  const isTextOnly = component.children.every(
    (child) => components.get(child)?.component === 'Text'
  );

  if (isTextOnly) {
    return component.component === 'Row' ? '$s' : '$xs';
  }

  return '$m';
}

function hasButtonChild(
  component: A2UI.Container,
  components: Map<string, A2UI.Component>
) {
  return component.children.some(
    (child) => components.get(child)?.component === 'Button'
  );
}

function getButtonTreatment(component: A2UI.Button) {
  switch (component.variant) {
    case 'primary':
      return { fill: 'solid', intent: 'positive' } as const;
    case 'secondary':
    case 'borderless':
    default:
      return { fill: 'outline', intent: 'secondary' } as const;
  }
}

function getJustifyContent(justify?: A2UI.Container['justify']) {
  switch (justify) {
    case 'center':
      return 'center';
    case 'end':
      return 'flex-end';
    case 'spaceBetween':
      return 'space-between';
    case 'spaceAround':
      return 'space-around';
    default:
      return 'flex-start';
  }
}

function getAlignItems(
  align?: A2UI.Container['align'],
  fallback: 'center' | 'stretch' = 'center'
) {
  switch (align) {
    case 'start':
      return 'flex-start';
    case 'center':
      return 'center';
    case 'end':
      return 'flex-end';
    case 'stretch':
      return 'stretch';
    default:
      return fallback;
  }
}

function getComponentFlex(component: A2UI.Component) {
  return component.weight === undefined ? undefined : component.weight;
}

function getTextAlign(align?: A2UI.Container['align']) {
  return align === 'center' ? 'center' : undefined;
}

function getComponentText(
  component: A2UI.Component | undefined,
  components: Map<string, A2UI.Component>
): string {
  if (!component) {
    return '';
  }
  switch (component.component) {
    case 'Text':
      return component.text;
    case 'Button':
    case 'Card':
      return getComponentText(components.get(component.child), components);
    case 'Row':
    case 'Column':
      return component.children
        .map((child) => getComponentText(components.get(child), components))
        .filter(Boolean)
        .join(' ');
    case 'Choice':
    case 'SmallChoice':
      // Text extraction feeds previews and labels: the option titles are the
      // meaningful summary of a choice group.
      return component.options.map((option) => option.label).join(', ');
    case 'Divider':
      return '';
  }
}

/**
 * Space above a group of controls — the purpose rows, the topic pills, the
 * invite field. Each of these follows the line of prose that introduces it,
 * and the surface's own gap is sized for text, which leaves a control looking
 * like part of the sentence above it.
 */
const CONTROL_GROUP_TOP_MARGIN = '$m';

/**
 * An A2UI button carrying `tlon.inviteLink` is a slot, not a control: the
 * card asks for the group's invite link, and the client fills it with the
 * same invite affordance the rest of the app uses. Nothing about the link
 * travels through the card, so it can't go stale and the sender never has to
 * mint one.
 */
function A2UIInviteLink({ groupId }: { groupId: string }) {
  const { data: group } = useGroup({ id: groupId });
  if (!group) {
    return null;
  }
  return (
    <YStack marginTop={CONTROL_GROUP_TOP_MARGIN}>
      <InviteFriendsToTlonButton group={group} />
    </YStack>
  );
}

export function A2UIBlock({
  block,
  ...props
}: { block: A2UIBlockData } & ComponentProps<typeof YStack>) {
  const { isA2UIActionAvailable, onA2UIAction } = useContentContext();
  const update = A2UI.getUpdateMessage(block.a2ui);
  const root = A2UI.getRootComponentId(block.a2ui);
  const components = useMemo(() => {
    return new Map(
      update?.updateComponents.components.map((component) => [
        component.id,
        component,
      ]) ?? []
    );
  }, [update]);

  const handleButtonPress = useCallback(
    (component: A2UI.Button) => {
      if (
        component.action.event.name === A2UI.action.sendMessage &&
        !component.action.event.context.text.trim()
      ) {
        return;
      }

      onA2UIAction?.(component.action);
    },
    [onA2UIAction]
  );

  const handleChoicePress = useCallback(
    (action: A2UI.ChoiceOption['action']) => {
      if (
        action.event.name === A2UI.action.sendMessage &&
        !action.event.context.text.trim()
      ) {
        return;
      }

      onA2UIAction?.(action);
    },
    [onA2UIAction]
  );

  const handleSmallChoiceSubmit = useCallback(
    (text: string) =>
      onA2UIAction?.({
        event: { name: A2UI.action.sendMessage, context: { text } },
      }),
    [onA2UIAction]
  );

  const renderComponent = useCallback(
    (id: string, options: RenderOptions = {}): React.ReactNode => {
      const component = components.get(id);
      if (!component) {
        return null;
      }

      switch (component.component) {
        case 'Text': {
          return (
            <Text
              key={component.id}
              size={getTextSize(component)}
              color={getTextColor(component)}
              textAlign={getTextAlign(options.parentAlign)}
              flex={getComponentFlex(component)}
            >
              {component.text}
            </Text>
          );
        }
        case 'Row':
          return (
            <XStack
              key={component.id}
              gap={getComponentGap(component, components)}
              marginTop={
                hasButtonChild(component, components) ? '$l' : undefined
              }
              alignItems={getAlignItems(component.align)}
              justifyContent={getJustifyContent(component.justify)}
              flexWrap="wrap"
              width="100%"
              flex={getComponentFlex(component)}
            >
              {component.children.map((child) =>
                renderComponent(child, {
                  cardDepth: options.cardDepth,
                  parentAlign: component.align,
                })
              )}
            </XStack>
          );
        case 'Column': {
          return (
            <YStack
              key={component.id}
              gap={getComponentGap(component, components)}
              alignItems={getAlignItems(component.align, 'stretch')}
              justifyContent={getJustifyContent(component.justify)}
              flex={getComponentFlex(component)}
            >
              {component.children.map((child) =>
                renderComponent(child, {
                  cardDepth: options.cardDepth,
                  parentAlign: component.align,
                })
              )}
            </YStack>
          );
        }
        case 'Card': {
          const isNestedCard = Boolean(options.cardDepth);
          return (
            <YStack
              key={component.id}
              borderWidth={1}
              borderColor="$border"
              borderRadius="$m"
              backgroundColor={
                isNestedCard ? '$background' : '$secondaryBackground'
              }
              padding={isNestedCard ? '$2xl' : '$l'}
              gap={isNestedCard ? '$l' : '$m'}
              flex={getComponentFlex(component)}
              width={isNestedCard ? '100%' : undefined}
              alignSelf={isNestedCard ? 'stretch' : 'flex-start'}
              overflow="hidden"
            >
              {renderComponent(component.child, {
                cardDepth: (options.cardDepth ?? 0) + 1,
              })}
            </YStack>
          );
        }
        case 'Divider':
          return (
            <View
              key={component.id}
              height={1}
              backgroundColor="$border"
              marginVertical="$xs"
              width="100%"
              flex={getComponentFlex(component)}
            />
          );
        case 'Button': {
          if (component.action.event.name === A2UI.action.inviteLink) {
            // Mounting this control turns the group's invite links on, so an
            // untrusted or mismatched card renders as nothing rather than as
            // a dead button — the surrounding text still explains the ask.
            if (isA2UIActionAvailable?.(component.action) === false) {
              return null;
            }
            return (
              <A2UIInviteLink
                key={component.id}
                groupId={component.action.event.context.groupId}
              />
            );
          }
          const disabled =
            component.disabled ||
            !onA2UIAction ||
            isA2UIActionAvailable?.(component.action) === false;
          const label = getComponentText(
            components.get(component.child),
            components
          );
          const treatment = getButtonTreatment(component);
          return (
            <Button.Frame
              key={component.id}
              size="medium"
              fill={treatment.fill}
              intent={treatment.intent}
              alignSelf={
                options.parentAlign === 'center' ? 'center' : 'flex-start'
              }
              height={44}
              paddingHorizontal="$xl"
              flex={getComponentFlex(component)}
              disabled={disabled}
              dimmed={disabled}
              onPress={
                disabled ? undefined : () => handleButtonPress(component)
              }
            >
              <Button.Text size="medium">{label}</Button.Text>
            </Button.Frame>
          );
        }
        case 'Choice': {
          return (
            <YStack
              key={component.id}
              gap="$m"
              width="100%"
              marginTop={CONTROL_GROUP_TOP_MARGIN}
            >
              {component.options.map((option) => {
                const accent = CHOICE_ACCENT_COLORS[option.accent ?? 'neutral'];
                const disabled =
                  !onA2UIAction ||
                  isA2UIActionAvailable?.(option.action) === false;
                return (
                  <Pressable
                    key={option.id}
                    testID={`A2UIChoice-${option.id}`}
                    accessibilityLabel={option.label}
                    disabled={disabled}
                    onPress={
                      disabled
                        ? undefined
                        : () => handleChoicePress(option.action)
                    }
                  >
                    <XStack
                      borderWidth={1}
                      borderColor="$border"
                      borderRadius="$xl"
                      backgroundColor="$background"
                      paddingVertical="$l"
                      paddingHorizontal="$l"
                      gap="$l"
                      alignItems="flex-start"
                      opacity={disabled ? 0.5 : 1}
                    >
                      {option.icon ? (
                        <View
                          width={32}
                          height={32}
                          borderRadius="$m"
                          backgroundColor={accent.soft}
                          alignItems="center"
                          justifyContent="center"
                          flexShrink={0}
                        >
                          <Icon
                            type={option.icon}
                            color={accent.strong}
                            customSize={[18, 18]}
                          />
                        </View>
                      ) : null}
                      <YStack flex={1} minWidth={0} gap="$2xs">
                        <Text size="$label/l" fontWeight="500" trimmed={false}>
                          {option.label}
                        </Text>
                        {option.description ? (
                          <Text
                            size="$label/m"
                            color="$secondaryText"
                            trimmed={false}
                          >
                            {option.description}
                          </Text>
                        ) : null}
                      </YStack>
                    </XStack>
                  </Pressable>
                );
              })}
            </YStack>
          );
        }
        case 'SmallChoice': {
          return (
            <SmallChoicePills
              key={component.id}
              component={component}
              canSend={Boolean(onA2UIAction)}
              isActionAvailable={isA2UIActionAvailable}
              onSubmit={handleSmallChoiceSubmit}
            />
          );
        }
      }
    },
    [
      components,
      handleButtonPress,
      handleChoicePress,
      handleSmallChoiceSubmit,
      isA2UIActionAvailable,
      onA2UIAction,
    ]
  );

  if (!root) {
    return null;
  }

  return (
    <YStack gap="$s" maxWidth={560} {...props}>
      {renderComponent(root)}
    </YStack>
  );
}
