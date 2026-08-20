import { A2UI, type A2UIBlockData } from '@tloncorp/shared/logic';
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
import { McpConnectControl } from './McpConnectControl';
import {
  getSmallChoiceCompletionPresentation,
  getSmallChoiceMessageSelection,
  isConsumableA2UIAction,
} from './a2uiActionConsumption';
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
const RETIRED_TIMEZONE_SURFACE_PREFIX = 'agent-onboarding-timezone:';

function smallChoiceShortcut(index: number) {
  return index < 26 ? String.fromCharCode(65 + index) : String(index + 1);
}

function SmallChoiceRow({
  disabled,
  isLast,
  isSelected,
  label,
  onPress,
  shortcut,
  testID,
}: {
  disabled: boolean;
  isLast: boolean;
  isSelected: boolean;
  label: string;
  onPress: () => void;
  shortcut: string;
  testID: string;
}) {
  // Tamagui's compiler can drop inline ternaries on token-valued props.
  const shortcutFill = isSelected ? '$primaryText' : '$secondaryBackground';
  const shortcutLabel = isSelected ? '$background' : '$secondaryText';

  return (
    <Pressable
      testID={testID}
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected: isSelected }}
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
    >
      <XStack
        minHeight={52}
        paddingVertical="$m"
        paddingHorizontal="$m"
        backgroundColor="$background"
        borderBottomWidth={isLast ? 0 : 1}
        borderBottomColor="$border"
        opacity={disabled ? 0.5 : 1}
        alignItems="center"
        gap="$m"
      >
        <View
          width={28}
          height={28}
          borderRadius="$s"
          backgroundColor={shortcutFill}
          alignItems="center"
          justifyContent="center"
          flexShrink={0}
        >
          <Text size="$label/s" color={shortcutLabel} trimmed={false}>
            {shortcut}
          </Text>
        </View>
        <Text
          size="$label/l"
          color="$primaryText"
          trimmed={false}
          flex={1}
          minWidth={0}
          numberOfLines={1}
        >
          {label}
        </Text>
        {isSelected ? (
          <Icon type="Checkmark" color="$primaryText" customSize={[16, 16]} />
        ) : null}
      </XStack>
    </Pressable>
  );
}

/**
 * A compact questionnaire for selecting several short answers. Selection is
 * local until submit — no per-tap posting — so it lives in a child component
 * with its own state rather than in the render callback.
 */
function SmallChoiceControl({
  component,
  canSend,
  consumedTopics,
  consumedMessageText,
  isActionAvailable,
  isActionConsumed,
  onSubmit,
}: {
  component: A2UI.SmallChoice;
  /** false when there is no action handler at all */
  canSend: boolean;
  /** Durable topics recovered from the later provision post after remount. */
  consumedTopics?: string[];
  /** Durable owner text recovered after this surface. */
  consumedMessageText?: string;
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
  const customChoiceLabel =
    component.freeTextPlaceholder?.replace(/…+$/, '') || '';
  const customTopicSummary = customTopics.join(', ');
  const durableSelection =
    consumedTopics ??
    getSmallChoiceMessageSelection(component, consumedMessageText);
  const completionPresentation = getSmallChoiceCompletionPresentation({
    actionConsumed,
    consumedLocally,
    durableTopics: durableSelection,
    localTopics: topicsForSelection,
  });
  const collapsedTopics = completionPresentation.topics;
  const collapsedSelection = collapsedTopics.join(', ');
  const selectedCount = collapsedTopics.length;
  const hasSelection = Boolean(messageForSelection);

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
      <YStack
        width="100%"
        padding="$m"
        gap="$m"
        borderRadius="$xl"
        backgroundColor="$secondaryBackground"
      >
        {completionPresentation.collapsed ? (
          <XStack
            minHeight={52}
            paddingVertical="$m"
            paddingHorizontal="$m"
            backgroundColor="$background"
            borderWidth={1}
            borderColor="$border"
            borderRadius="$m"
            alignItems="center"
            gap="$m"
          >
            <View
              width={28}
              height={28}
              borderRadius="$s"
              backgroundColor="$secondaryBackground"
              alignItems="center"
              justifyContent="center"
              flexShrink={0}
            >
              <Text size="$label/s" color="$secondaryText" trimmed={false}>
                {selectedCount}
              </Text>
            </View>
            <Text
              size="$label/l"
              color="$secondaryText"
              trimmed={false}
              flex={1}
              minWidth={0}
              numberOfLines={1}
            >
              {collapsedSelection}
            </Text>
            <Icon
              type="Checkmark"
              color="$secondaryText"
              customSize={[16, 16]}
            />
          </XStack>
        ) : (
          <>
            <YStack
              width="100%"
              borderWidth={1}
              borderColor="$border"
              borderRadius="$m"
              overflow="hidden"
            >
              {component.options.map((option, index) => {
                const isSelected = selectedIds.includes(option.id);
                const isLast = index === component.options.length - 1;
                return (
                  <SmallChoiceRow
                    key={option.id}
                    testID={`A2UISmallChoice-${option.id}`}
                    label={option.label}
                    shortcut={smallChoiceShortcut(index)}
                    isSelected={isSelected}
                    isLast={isLast}
                    disabled={disabled}
                    onPress={() => toggle(option.id)}
                  />
                );
              })}
            </YStack>
            {component.freeTextPlaceholder ? (
              <Pressable
                testID="A2UISmallChoiceCustom"
                accessibilityLabel={
                  customTopics.length
                    ? `Edit custom topics: ${customTopicSummary}`
                    : `Add ${customChoiceLabel}`
                }
                accessibilityState={{ disabled }}
                disabled={disabled}
                onPress={disabled ? undefined : openCustomInput}
              >
                <XStack
                  minHeight={52}
                  paddingHorizontal="$m"
                  backgroundColor="$background"
                  borderWidth={1}
                  borderColor="$border"
                  borderRadius="$m"
                  alignItems="center"
                  gap="$m"
                  opacity={disabled ? 0.5 : 1}
                >
                  <View
                    width={28}
                    height={28}
                    borderRadius="$s"
                    backgroundColor="$secondaryBackground"
                    alignItems="center"
                    justifyContent="center"
                    flexShrink={0}
                  >
                    {customTopics.length ? (
                      <Text
                        size="$label/s"
                        color="$secondaryText"
                        trimmed={false}
                      >
                        {customTopics.length}
                      </Text>
                    ) : (
                      <Icon
                        type="Add"
                        color="$secondaryText"
                        customSize={[14, 14]}
                      />
                    )}
                  </View>
                  <Text
                    size="$label/l"
                    color={
                      customTopics.length ? '$primaryText' : '$secondaryText'
                    }
                    trimmed={false}
                    flex={1}
                    minWidth={0}
                    numberOfLines={1}
                  >
                    {customTopics.length
                      ? customTopicSummary
                      : customChoiceLabel}
                  </Text>
                  {customTopics.length ? (
                    <Icon
                      type="ChevronRight"
                      color="$secondaryText"
                      customSize={[16, 16]}
                    />
                  ) : null}
                </XStack>
              </Pressable>
            ) : null}
            <Pressable
              testID="A2UISmallChoiceSubmit"
              accessibilityLabel={component.submitLabel}
              accessibilityState={{ disabled: submitDisabled }}
              disabled={submitDisabled}
              onPress={submitDisabled ? undefined : handleSubmit}
            >
              <XStack
                minHeight={52}
                paddingHorizontal="$m"
                backgroundColor={hasSelection ? '$primaryText' : '$background'}
                borderWidth={1}
                borderColor="$border"
                borderRadius="$m"
                alignItems="center"
                gap="$m"
                opacity={submitDisabled ? 0.5 : 1}
              >
                <Text
                  size="$label/l"
                  color={hasSelection ? '$background' : '$primaryText'}
                  trimmed={false}
                  flex={1}
                >
                  {component.submitLabel}
                </Text>
                <Icon
                  type="Checkmark"
                  color={hasSelection ? '$background' : '$primaryText'}
                  customSize={[16, 16]}
                />
              </XStack>
            </Pressable>
          </>
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
            {customTopics.length ? (
              <ActionSheet.FormBlock>
                <YStack width="100%">
                  {customTopics.map((topic, index) => (
                    <Pressable
                      key={topic}
                      testID={`A2UISmallChoiceCustom-${index}`}
                      accessibilityLabel={`Remove ${topic}`}
                      onPress={() => removeCustomTopic(topic)}
                    >
                      <XStack
                        minHeight={48}
                        paddingHorizontal="$m"
                        alignItems="center"
                        gap="$m"
                        borderBottomWidth={
                          index === customTopics.length - 1 ? 0 : 1
                        }
                        borderBottomColor="$border"
                      >
                        <Text
                          size="$label/l"
                          color="$primaryText"
                          trimmed={false}
                          flex={1}
                          numberOfLines={1}
                        >
                          {topic}
                        </Text>
                        <Icon
                          type="Close"
                          color="$secondaryText"
                          customSize={[14, 14]}
                        />
                      </XStack>
                    </Pressable>
                  ))}
                </YStack>
              </ActionSheet.FormBlock>
            ) : null}
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
    case 'McpConnect':
      return component.seeAllLabel;
    case 'Divider':
      return '';
  }
}

export function A2UIBlock({
  block,
  ...props
}: { block: A2UIBlockData } & ComponentProps<typeof YStack>) {
  const {
    isA2UIActionAvailable,
    isA2UIActionConsumed,
    configuredAgentProviderIds,
    provisionedAgentTopics,
    consumedA2UIMessageText,
    onA2UIAction,
  } = useContentContext();
  const [locallyConsumedComponentIds, setLocallyConsumedComponentIds] =
    useState<string[]>([]);
  const [locallyConsumedChoices, setLocallyConsumedChoices] = useState<
    Record<string, string>
  >({});
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
      if (isConsumableA2UIAction(component.action)) {
        setLocallyConsumedComponentIds((previous) =>
          previous.includes(component.id)
            ? previous
            : [...previous, component.id]
        );
      }
    },
    [onA2UIAction]
  );

  const handleChoicePress = useCallback(
    async (
      componentId: string,
      optionId: string,
      action: A2UI.ChoiceOption['action']
    ) => {
      if (
        choicePressLocksRef.current.has(componentId) ||
        (action.event.name === A2UI.action.sendMessage &&
          !action.event.context.text.trim())
      ) {
        return;
      }

      // Lock synchronously, before React can re-render, so two rapid taps on
      // different options still produce exactly one owner reply.
      const consumeAction = isConsumableA2UIAction(action);
      choicePressLocksRef.current.add(componentId);
      if (consumeAction) {
        setLocallyConsumedChoices((previous) => ({
          ...previous,
          [componentId]: optionId,
        }));
      }
      try {
        await onA2UIAction?.(action);
      } catch {
        choicePressLocksRef.current.delete(componentId);
        if (consumeAction) {
          setLocallyConsumedChoices((previous) => {
            const next = { ...previous };
            delete next[componentId];
            return next;
          });
        }
      } finally {
        // Navigation and other reusable actions only need an in-flight lock;
        // once the action completes, the same control should remain tappable.
        if (!consumeAction) {
          choicePressLocksRef.current.delete(componentId);
        }
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
          const actionCanBeConsumed = isConsumableA2UIAction(component.action);
          const actionConsumed =
            actionCanBeConsumed &&
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
              opacity={actionConsumed ? 0.5 : 1}
              pointerEvents={actionConsumed ? 'none' : 'auto'}
              accessibilityElementsHidden={false}
              importantForAccessibility="auto"
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
          const selectedOption =
            component.options.find(
              (option) => isA2UIActionConsumed?.(option.action) === true
            ) ??
            component.options.find(
              (option) => option.id === locallyConsumedChoices[component.id]
            );
          const choiceConsumed = Boolean(selectedOption);
          const grouped = component.options.length > 1;
          const compact =
            grouped &&
            component.options.every(
              (option) => !option.icon && !option.description
            );
          const choices = component.options.map((option, index) => {
            const accent = CHOICE_ACCENT_COLORS[option.accent ?? 'neutral'];
            // The accent is normally carried by the icon chip. An option
            // that asks for one without an icon would otherwise render
            // identically to a neutral card — the accent silently doing
            // nothing — so let the card itself carry it instead. A single
            // accented card in a message reads as the thing to tap; the
            // multi-option pickers all have icons and are untouched.
            const accentedCard = Boolean(
              option.accent && option.accent !== 'neutral' && !option.icon
            );
            const disabled =
              choiceConsumed ||
              !onA2UIAction ||
              isA2UIActionAvailable?.(option.action) === false;
            const isLast = index === component.options.length - 1;
            if (compact) {
              return (
                <SmallChoiceRow
                  key={option.id}
                  testID={`A2UIChoice-${option.id}`}
                  label={option.label}
                  shortcut={smallChoiceShortcut(index)}
                  isSelected={false}
                  isLast={isLast}
                  disabled={disabled}
                  onPress={() =>
                    handleChoicePress(component.id, option.id, option.action)
                  }
                />
              );
            }
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
                    : () =>
                        handleChoicePress(
                          component.id,
                          option.id,
                          option.action
                        )
                }
              >
                <XStack
                  minHeight={grouped ? 68 : undefined}
                  borderWidth={grouped ? 0 : accentedCard ? 2 : 1}
                  borderBottomWidth={grouped && !isLast ? 1 : undefined}
                  borderColor={accentedCard ? accent.strong : '$border'}
                  borderBottomColor="$border"
                  borderRadius={grouped ? 0 : '$xl'}
                  backgroundColor="$background"
                  paddingVertical={grouped ? '$m' : '$l'}
                  paddingHorizontal={grouped ? '$m' : '$l'}
                  gap="$m"
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
          });
          return (
            <YStack
              key={component.id}
              width="100%"
              marginTop={CHOICE_CONTROL_OUTER_MARGIN}
              padding={grouped ? '$m' : undefined}
              gap={grouped ? undefined : '$m'}
              borderRadius={grouped ? '$xl' : undefined}
              backgroundColor={grouped ? '$secondaryBackground' : undefined}
            >
              {grouped && selectedOption && compact ? (
                <YStack
                  width="100%"
                  borderWidth={1}
                  borderColor="$border"
                  borderRadius="$m"
                  overflow="hidden"
                >
                  <SmallChoiceRow
                    testID={`A2UIChoice-${selectedOption.id}`}
                    label={selectedOption.label}
                    shortcut={smallChoiceShortcut(
                      component.options.indexOf(selectedOption)
                    )}
                    isSelected
                    isLast
                    disabled
                    onPress={() => undefined}
                  />
                </YStack>
              ) : grouped && selectedOption ? (
                <XStack
                  minHeight={52}
                  paddingVertical="$m"
                  paddingHorizontal="$m"
                  backgroundColor="$background"
                  borderWidth={1}
                  borderColor="$border"
                  borderRadius="$m"
                  alignItems="center"
                  gap="$m"
                >
                  {selectedOption.icon ? (
                    <View
                      width={32}
                      height={32}
                      borderRadius="$m"
                      backgroundColor={
                        CHOICE_ACCENT_COLORS[selectedOption.accent ?? 'neutral']
                          .soft
                      }
                      alignItems="center"
                      justifyContent="center"
                      flexShrink={0}
                    >
                      <Icon
                        type={selectedOption.icon}
                        color={
                          CHOICE_ACCENT_COLORS[
                            selectedOption.accent ?? 'neutral'
                          ].strong
                        }
                        customSize={[18, 18]}
                      />
                    </View>
                  ) : null}
                  <Text
                    size="$label/l"
                    color="$secondaryText"
                    trimmed={false}
                    flex={1}
                    minWidth={0}
                    numberOfLines={1}
                  >
                    {selectedOption.label}
                  </Text>
                  <Icon
                    type="Checkmark"
                    color="$secondaryText"
                    customSize={[16, 16]}
                  />
                </XStack>
              ) : grouped ? (
                <YStack
                  width="100%"
                  borderWidth={1}
                  borderColor="$border"
                  borderRadius="$m"
                  overflow="hidden"
                >
                  {choices}
                </YStack>
              ) : (
                choices
              )}
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
              <SmallChoiceControl
                component={component}
                canSend={Boolean(onA2UIAction)}
                consumedTopics={provisionedAgentTopics}
                consumedMessageText={consumedA2UIMessageText}
                isActionAvailable={isA2UIActionAvailable}
                isActionConsumed={isA2UIActionConsumed}
                onSubmit={handleSmallChoiceSubmit}
              />
            </YStack>
          );
        }
        case 'McpConnect':
          return (
            <YStack
              key={component.id}
              width="100%"
              marginTop={CHOICE_CONTROL_OUTER_MARGIN}
            >
              <McpConnectControl
                component={component}
                configuredProviderIds={configuredAgentProviderIds}
                onConfigure={
                  isA2UIActionAvailable?.(component.configureAction) === false
                    ? undefined
                    : onA2UIAction
                }
                onNavigate={onA2UIAction}
              />
            </YStack>
          );
      }
    },
    [
      components,
      configuredAgentProviderIds,
      consumedA2UIMessageText,
      provisionedAgentTopics,
      handleButtonPress,
      handleChoicePress,
      handleSmallChoiceSubmit,
      isA2UIActionAvailable,
      isA2UIActionConsumed,
      locallyConsumedComponentIds,
      locallyConsumedChoices,
      onA2UIAction,
      surfaceId,
    ]
  );

  // Old plugin builds persisted a separate timezone picker in chat. Current
  // onboarding binds the device timezone directly to topic confirmation, so
  // hide any legacy surface that remains in durable history.
  if (surfaceId.startsWith(RETIRED_TIMEZONE_SURFACE_PREFIX) || !root) {
    return null;
  }

  return (
    <YStack gap="$s" maxWidth={560} {...props}>
      {renderComponent(root)}
    </YStack>
  );
}
