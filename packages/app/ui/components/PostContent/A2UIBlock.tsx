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
import { View, XStack, YStack } from 'tamagui';

import { ActionSheet } from '../ActionSheet';
import { TextInput } from '../Form';
import { InviteFriendsToTlonButton } from '../InviteFriendsToTlonButton';
import { AgentOnboardingSurface } from './AgentOnboardingSurface';
import { useContentContext } from './contentUtils';

type RenderOptions = {
  cardDepth?: number;
  parentAlign?: A2UI.Container['align'];
  standaloneControlTopMargin?: boolean;
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

// Cardless choice controls sit alongside ordinary chat text inside the same
// A2UI post. Keep that outer rhythm identical around cards and pill groups.
const CHOICE_CONTROL_OUTER_MARGIN = 15;
const SMALL_CHOICE_SUBMIT_GAP = '$s';

function SmallChoicePill({
  disabled,
  isSelected,
  label,
  onPress,
  showAddIcon = false,
  showRemoveIcon = false,
  testID,
}: {
  disabled: boolean;
  isSelected: boolean;
  label: string;
  onPress: () => void;
  showAddIcon?: boolean;
  showRemoveIcon?: boolean;
  testID: string;
}) {
  // Selected inverts the pill instead of tinting it, so a chosen topic reads
  // at a glance across a wrapped row. Hoisted out of JSX: an inline ternary on
  // these props gets dropped by Tamagui's compiler.
  const pillEdge = isSelected ? '$primaryText' : '$border';
  const pillFill = isSelected ? '$primaryText' : '$background';
  const pillLabel = isSelected ? '$background' : '$primaryText';

  return (
    <Pressable
      testID={testID}
      accessibilityLabel={
        showAddIcon
          ? `Add ${label}`
          : showRemoveIcon
            ? `Remove ${label}`
            : label
      }
      accessibilityState={{ disabled, selected: isSelected }}
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
    >
      <XStack
        borderWidth={1}
        borderColor={pillEdge}
        backgroundColor={pillFill}
        borderRadius="$2xl"
        paddingVertical="$s"
        paddingHorizontal="$l"
        opacity={disabled ? 0.5 : 1}
        alignItems="center"
        gap="$xs"
        maxWidth={260}
      >
        {showAddIcon ? (
          <Icon type="Add" color={pillLabel} customSize={[14, 14]} />
        ) : null}
        <Text
          size="$label/m"
          color={pillLabel}
          trimmed={false}
          numberOfLines={1}
        >
          {label}
        </Text>
        {showRemoveIcon ? (
          <Icon type="Close" color={pillLabel} customSize={[12, 12]} />
        ) : null}
      </XStack>
    </Pressable>
  );
}

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
  isActionConsumed,
  onSubmit,
}: {
  component: A2UI.SmallChoice;
  /** false when there is no action handler at all */
  canSend: boolean;
  isActionAvailable?: (action: A2UI.ButtonAction) => boolean;
  isActionConsumed?: (action: A2UI.ButtonAction) => boolean;
  onSubmit: (action: A2UI.ButtonAction) => void | Promise<void>;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [customTopics, setCustomTopics] = useState<string[]>([]);
  const [customDraft, setCustomDraft] = useState('');
  const [customInputOpen, setCustomInputOpen] = useState(false);
  // Lock the whole picker synchronously when submit starts. React state alone
  // leaves a brief window before re-render where a pill can still be toggled.
  // Keep the lock after success; only release it when the send fails.
  const [submitted, setSubmitted] = useState(false);
  const [consumedLocally, setConsumedLocally] = useState(false);
  const submittingRef = useRef(false);

  const toggle = useCallback((id: string) => {
    if (submittingRef.current) {
      return;
    }
    setSelectedIds((previous) =>
      previous.includes(id)
        ? previous.filter((selected) => selected !== id)
        : [...previous, id]
    );
  }, []);

  const messageForSelection = A2UI.buildSmallChoiceMessage(
    component,
    selectedIds,
    customTopics.join(', ')
  );
  const topicsForSelection = [
    ...component.options
      .filter((option) => selectedIds.includes(option.id))
      .map((option) => option.label),
    ...customTopics,
  ];
  const actionForSelection: A2UI.ButtonAction =
    component.action.event.name === A2UI.action.provisionAgent
      ? {
          event: {
            ...component.action.event,
            context: {
              ...component.action.event.context,
              topics: topicsForSelection,
            },
          },
        }
      : {
          event: {
            name: A2UI.action.sendMessage,
            context: { text: messageForSelection },
          },
        };

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
      await onSubmit(actionForSelection);
      setConsumedLocally(true);
    } catch {
      // The transport reports failures elsewhere; this surface only needs to
      // become available again so the owner can retry.
      submittingRef.current = false;
      setSubmitted(false);
    }
  }, [actionForSelection, messageForSelection, onSubmit]);

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
  const probe = (action: A2UI.ButtonAction): boolean =>
    canSend && isActionAvailable?.(action) !== false;
  const probeAction: A2UI.ButtonAction =
    component.action.event.name === A2UI.action.provisionAgent
      ? component.action
      : {
          event: {
            name: A2UI.action.sendMessage,
            context: { text: A2UI.smallChoiceProbeMessage(component) },
          },
        };

  const submitAction = messageForSelection ? actionForSelection : probeAction;
  const actionConsumed =
    consumedLocally || isActionConsumed?.(submitAction) === true;
  // A durable owner reply consumes the entire picker, not just its submit
  // button. Without this guard a remounted historical picker could still
  // toggle pills after onboarding had already advanced to the next prompt.
  const disabled = submitted || actionConsumed || !probe(probeAction);
  const submitDisabled =
    disabled || !messageForSelection || !probe(actionForSelection);
  const showSubmit = !actionConsumed && Boolean(messageForSelection);
  const customChoiceLabel =
    component.freeTextPlaceholder?.replace(/…+$/, '') || '';

  const openCustomInput = useCallback(() => {
    if (submittingRef.current) {
      return;
    }
    setCustomDraft('');
    setCustomInputOpen(true);
  }, []);

  const saveCustomInput = useCallback(() => {
    if (submittingRef.current) {
      return;
    }
    const topic = customDraft.trim();
    if (!topic) return;

    const matchingOption = component.options.find(
      (option) => option.label.toLocaleLowerCase() === topic.toLocaleLowerCase()
    );
    if (matchingOption) {
      setSelectedIds((previous) =>
        previous.includes(matchingOption.id)
          ? previous
          : [...previous, matchingOption.id]
      );
    } else {
      setCustomTopics((previous) =>
        previous.some(
          (existing) =>
            existing.toLocaleLowerCase() === topic.toLocaleLowerCase()
        )
          ? previous
          : [...previous, topic]
      );
    }
    setCustomInputOpen(false);
  }, [component.options, customDraft]);

  const removeCustomTopic = useCallback((topic: string) => {
    if (submittingRef.current) {
      return;
    }
    setCustomTopics((previous) =>
      previous.filter((existing) => existing !== topic)
    );
  }, []);

  return (
    <>
      <YStack width="100%">
        <XStack
          flexWrap="wrap"
          gap="$s"
          width="100%"
          marginBottom={SMALL_CHOICE_SUBMIT_GAP}
        >
          {component.options.map((option) => {
            const isSelected = selectedIds.includes(option.id);
            return (
              <SmallChoicePill
                key={option.id}
                testID={`A2UISmallChoice-${option.id}`}
                label={option.label}
                isSelected={isSelected}
                disabled={disabled}
                onPress={() => toggle(option.id)}
              />
            );
          })}
          {customTopics.map((topic, index) => (
            <SmallChoicePill
              key={topic}
              testID={`A2UISmallChoiceCustom-${index}`}
              label={topic}
              isSelected
              showRemoveIcon
              disabled={disabled}
              onPress={() => removeCustomTopic(topic)}
            />
          ))}
          {component.freeTextPlaceholder ? (
            <SmallChoicePill
              testID="A2UISmallChoiceCustom"
              label={customChoiceLabel}
              showAddIcon
              isSelected={false}
              disabled={disabled}
              onPress={openCustomInput}
            />
          ) : null}
        </XStack>
        {/*
          The slot is held open while the picker is still answerable so the
          pills don't jump the moment a first selection reveals the submit
          button. Once the picker is consumed that reservation can never be
          filled again, and an answered picker was left with 44px of blank
          space under its pills forever — so collapse it then.
        */}
        {actionConsumed ? null : (
          <YStack
            height={44}
            alignItems="flex-start"
            opacity={showSubmit ? 1 : 0}
            pointerEvents={showSubmit ? 'auto' : 'none'}
            accessibilityElementsHidden={!showSubmit}
            importantForAccessibility={
              showSubmit ? 'auto' : 'no-hide-descendants'
            }
          >
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
        )}
      </YStack>
      {component.freeTextPlaceholder ? (
        <ActionSheet
          moveOnKeyboardChange
          modal
          open={customInputOpen}
          onOpenChange={setCustomInputOpen}
          unmountOnClose
        >
          <ActionSheet.SimpleHeader title="Add your own" />
          <ActionSheet.Content testID="A2UISmallChoiceCustomSheet">
            <ActionSheet.FormBlock>
              <TextInput
                testID="A2UISmallChoiceFreeText"
                autoFocus
                value={customDraft}
                onChangeText={setCustomDraft}
                maxLength={1000}
                placeholder={component.freeTextPlaceholder}
                returnKeyType="done"
                onSubmitEditing={saveCustomInput}
              />
            </ActionSheet.FormBlock>
            <ActionSheet.FormBlock>
              <Button
                preset="primary"
                label="Save"
                centered
                onPress={saveCustomInput}
              />
            </ActionSheet.FormBlock>
          </ActionSheet.Content>
        </ActionSheet>
      ) : null}
    </>
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
    case 'AgentOnboarding':
      return component.purposes.map((purpose) => purpose.label).join(', ');
    case 'Divider':
      return '';
  }
}

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
  return <InviteFriendsToTlonButton group={group} />;
}

export function A2UIBlock({
  block,
  ...props
}: { block: A2UIBlockData } & ComponentProps<typeof YStack>) {
  const {
    isA2UIActionAvailable,
    isA2UIActionConsumed,
    onA2UIAction,
    onAgentOnboardingConfirm,
  } = useContentContext();
  const [locallyConsumedComponentIds, setLocallyConsumedComponentIds] =
    useState<string[]>([]);
  const [locallyConsumedChoiceIds, setLocallyConsumedChoiceIds] = useState<
    string[]
  >([]);
  const choicePressLocksRef = useRef(new Set<string>());
  const update = A2UI.getUpdateMessage(block.a2ui);
  const root = A2UI.getRootComponentId(block.a2ui);
  const surfaceId =
    block.a2ui.messages.find(
      (message): message is A2UI.CreateSurfaceMessage =>
        'createSurface' in message
    )?.createSurface.surfaceId ?? 'unknown-surface';
  const components = useMemo(() => {
    return new Map(
      update?.updateComponents.components.map((component) => [
        component.id,
        component,
      ]) ?? []
    );
  }, [update]);

  const handleButtonPress = useCallback(
    async (component: A2UI.Button) => {
      if (
        component.action.event.name === A2UI.action.sendMessage &&
        !component.action.event.context.text.trim()
      ) {
        return;
      }

      await onA2UIAction?.(component.action);
      setLocallyConsumedComponentIds((previous) =>
        previous.includes(component.id) ? previous : [...previous, component.id]
      );
    },
    [onA2UIAction]
  );

  const handleChoicePress = useCallback(
    async (componentId: string, action: A2UI.ChoiceOption['action']) => {
      if (
        choicePressLocksRef.current.has(componentId) ||
        (action.event.name === A2UI.action.sendMessage &&
          !action.event.context.text.trim())
      ) {
        return;
      }

      // Lock synchronously, before React can re-render, so two rapid taps on
      // different options still produce exactly one owner reply.
      choicePressLocksRef.current.add(componentId);
      setLocallyConsumedChoiceIds((previous) =>
        previous.includes(componentId) ? previous : [...previous, componentId]
      );
      try {
        await onA2UIAction?.(action);
      } catch {
        choicePressLocksRef.current.delete(componentId);
        setLocallyConsumedChoiceIds((previous) =>
          previous.filter((id) => id !== componentId)
        );
      }
    },
    [onA2UIAction]
  );

  const handleSmallChoiceSubmit = useCallback(
    (action: A2UI.ButtonAction) => onA2UIAction?.(action),
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
              {component.children.map((child, index) =>
                renderComponent(child, {
                  cardDepth: options.cardDepth,
                  parentAlign: component.align,
                  standaloneControlTopMargin:
                    !options.cardDepth &&
                    index > 0 &&
                    components.get(component.children[index - 1])?.component ===
                      'Text' &&
                    components.get(child)?.component === 'Button',
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
          const actionConsumed =
            component.variant === 'primary' &&
            (locallyConsumedComponentIds.includes(component.id) ||
              isA2UIActionConsumed?.(component.action) === true);
          const disabled =
            actionConsumed ||
            component.disabled ||
            !onA2UIAction ||
            isA2UIActionAvailable?.(component.action) === false;
          const label = getComponentText(
            components.get(component.child),
            components
          );
          const treatment = getButtonTreatment(component);
          // A consumed button is spent for good, so it leaves the layout
          // rather than sitting at zero opacity — otherwise every answered
          // surface keeps a 44px hole where its control used to be.
          if (actionConsumed) {
            return null;
          }
          return (
            <Button.Frame
              key={component.id}
              size="medium"
              fill={treatment.fill}
              intent={treatment.intent}
              alignSelf={
                options.parentAlign === 'center' ? 'center' : 'flex-start'
              }
              marginTop={
                options.standaloneControlTopMargin
                  ? CHOICE_CONTROL_OUTER_MARGIN
                  : undefined
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
          const choiceConsumed =
            locallyConsumedChoiceIds.includes(component.id) ||
            component.options.some(
              (option) => isA2UIActionConsumed?.(option.action) === true
            );
          return (
            <YStack
              key={component.id}
              gap="$m"
              width="100%"
              marginTop={CHOICE_CONTROL_OUTER_MARGIN}
            >
              {component.options.map((option) => {
                const accent = CHOICE_ACCENT_COLORS[option.accent ?? 'neutral'];
                const disabled =
                  choiceConsumed ||
                  !onA2UIAction ||
                  isA2UIActionAvailable?.(option.action) === false;
                return (
                  <Pressable
                    key={option.id}
                    testID={`A2UIChoice-${option.id}`}
                    accessibilityLabel={option.label}
                    accessibilityState={{ disabled }}
                    disabled={disabled}
                    onPress={
                      disabled
                        ? undefined
                        : () => handleChoicePress(component.id, option.action)
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
            <YStack
              key={component.id}
              width="100%"
              marginTop={CHOICE_CONTROL_OUTER_MARGIN}
            >
              <SmallChoicePills
                component={component}
                canSend={Boolean(onA2UIAction)}
                isActionAvailable={isA2UIActionAvailable}
                isActionConsumed={isA2UIActionConsumed}
                onSubmit={handleSmallChoiceSubmit}
              />
            </YStack>
          );
        }
        case 'AgentOnboarding':
          return (
            <AgentOnboardingSurface
              key={component.id}
              component={component}
              surfaceId={surfaceId}
              onConfirm={onAgentOnboardingConfirm}
            />
          );
      }
    },
    [
      components,
      handleButtonPress,
      handleChoicePress,
      handleSmallChoiceSubmit,
      isA2UIActionAvailable,
      isA2UIActionConsumed,
      locallyConsumedComponentIds,
      locallyConsumedChoiceIds,
      onA2UIAction,
      onAgentOnboardingConfirm,
      surfaceId,
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
