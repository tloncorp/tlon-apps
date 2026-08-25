import {
  AGENT_PROTOCOL_LIMITS,
  type PostBlobDataEntryA2UISelection,
} from '@tloncorp/api';
import { A2UI, type A2UIBlockData } from '@tloncorp/shared/logic';
import { Button, Icon, Pressable, Text } from '@tloncorp/ui';
import React, {
  ComponentProps,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { View, XStack, YStack, isWeb } from 'tamagui';

import { ActionSheet } from '../ActionSheet';
import { TextInput } from '../Form';
import { A2UIMenuRow } from './A2UIMenuRow';
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
function smallChoiceShortcut(index: number) {
  return String.fromCharCode(65 + index);
}

function isConsumableA2UIAction(action: A2UI.ButtonAction) {
  return (
    action.event.name === A2UI.action.sendMessage ||
    action.event.name === A2UI.action.provisionAgent
  );
}

/**
 * The durable record an owner-response action leaves on the post it creates.
 * Undefined for client-local actions (navigation), which are never consumed.
 */
function buildActionSelection(
  sourcePostId: string | undefined,
  surfaceId: string,
  componentId: string,
  action: A2UI.ButtonAction,
  optionId?: string
): PostBlobDataEntryA2UISelection | undefined {
  if (action.event.name === A2UI.action.sendMessage) {
    const text = action.event.context.text.trim();
    if (!text) {
      return undefined;
    }
    return {
      type: 'tlon-a2ui-selection',
      version: 1,
      sourcePostId,
      surfaceId,
      componentId,
      optionId,
      values: [text],
    };
  }
  if (action.event.name === A2UI.action.provisionAgent) {
    return {
      type: 'tlon-a2ui-selection',
      version: 1,
      sourcePostId,
      surfaceId,
      componentId,
      optionId,
      values: action.event.context.topics,
    };
  }
  return undefined;
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
    <A2UIMenuRow
      testID={testID}
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected: isSelected }}
      disabled={disabled}
      onPress={onPress}
      dividerAfter={!isLast}
      dividerOutside
      dimmed={disabled && !isSelected}
      label={label}
      paddingVertical="$m"
      leading={
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
      }
      trailing={
        isSelected ? (
          <Icon type="Checkmark" color="$primaryText" customSize={[16, 16]} />
        ) : null
      }
    />
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
  consumedSelection,
  onSubmit,
  sourcePostId,
  surfaceId,
}: {
  component: A2UI.SmallChoice;
  /** false when there is no action handler at all */
  canSend: boolean;
  /** Durable answer recovered from the viewer's own posts after remount. */
  consumedSelection?: PostBlobDataEntryA2UISelection;
  onSubmit: (
    action: A2UI.ButtonAction,
    selection: PostBlobDataEntryA2UISelection
  ) => void | Promise<void>;
  sourcePostId?: string;
  surfaceId: string;
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
  const durableSelectionObservedRef = useRef(false);

  useEffect(() => {
    if (consumedSelection) {
      durableSelectionObservedRef.current = true;
      return;
    }
    if (!durableSelectionObservedRef.current) return;

    // A successful reply was later deleted (or a failed optimistic row was
    // removed). Release the local lock so the durable timeline is once again
    // the source of truth and the owner can answer this control again.
    durableSelectionObservedRef.current = false;
    submittingRef.current = false;
    setSubmitted(false);
    setConsumedLocally(false);
  }, [consumedSelection]);

  const toggle = useCallback(
    (id: string) => {
      if (submittingRef.current) {
        return;
      }
      setSelectedIds((previous) => {
        if (previous.includes(id)) {
          return previous.filter((selected) => selected !== id);
        }
        if (
          previous.length + customTopics.length >=
          AGENT_PROTOCOL_LIMITS.topicCount
        ) {
          return previous;
        }
        return [...previous, id];
      });
    },
    [customTopics.length]
  );

  const messageForSelection = useMemo(
    () => A2UI.buildSmallChoiceMessage(component, selectedIds, customTopics),
    [component, customTopics, selectedIds]
  );
  const valuesForSelection = useMemo(
    () => [
      ...component.options
        .filter((option) => selectedIds.includes(option.id))
        .map((option) => option.label),
      ...customTopics,
    ],
    [component.options, customTopics, selectedIds]
  );
  const actionForSelection = useMemo<A2UI.ButtonAction>(
    () =>
      component.action.event.name === A2UI.action.provisionAgent
        ? {
            event: {
              ...component.action.event,
              context: {
                ...component.action.event.context,
                topics: valuesForSelection,
              },
            },
          }
        : {
            event: {
              name: A2UI.action.sendMessage,
              context: { text: messageForSelection },
            },
          },
    [component.action.event, messageForSelection, valuesForSelection]
  );
  const isProvisionAction =
    component.action.event.name === A2UI.action.provisionAgent;
  const hasValidSelection = isProvisionAction
    ? valuesForSelection.length > 0
    : Boolean(messageForSelection);

  const handleSubmit = useCallback(async () => {
    if (!hasValidSelection || submittingRef.current) {
      return;
    }
    // Disable first so a double tap can't send twice, but put it back if
    // the send fails: the picker is the only way to answer the setup, and
    // a card disabled over a message that never posted leaves the owner
    // looking at their own selection with nothing to do about it.
    submittingRef.current = true;
    setSubmitted(true);
    try {
      await onSubmit(actionForSelection, {
        type: 'tlon-a2ui-selection',
        version: 1,
        sourcePostId,
        surfaceId,
        componentId: component.id,
        values: valuesForSelection,
      });
      setConsumedLocally(true);
    } catch {
      // The transport reports failures elsewhere; this surface only needs to
      // become available again so the owner can retry.
      submittingRef.current = false;
      setSubmitted(false);
    }
  }, [
    actionForSelection,
    component.id,
    hasValidSelection,
    onSubmit,
    sourcePostId,
    surfaceId,
    valuesForSelection,
  ]);

  const completed = consumedLocally || Boolean(consumedSelection);
  const disabled = submitted || completed || !canSend;
  const submitDisabled = disabled || !hasValidSelection;
  const customChoiceLabel =
    component.freeTextPlaceholder?.replace(/…+$/, '') || '';
  const completedTopics = consumedLocally
    ? valuesForSelection
    : (consumedSelection?.values ?? []);
  const completedOptionLabels = new Set(
    component.options
      .filter((option) => completedTopics.includes(option.label))
      .map((option) => option.label)
  );
  const completedCustomTopics = completedTopics.filter(
    (topic) => !completedOptionLabels.has(topic)
  );
  const displayedCustomTopics = completed
    ? completedCustomTopics
    : customTopics;
  const displayedCustomTopicSummary = displayedCustomTopics.join(', ');
  const hasSelection = hasValidSelection;

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
        previous.includes(matchingOption.id) ||
        previous.length + customTopics.length >=
          AGENT_PROTOCOL_LIMITS.topicCount
          ? previous
          : [...previous, matchingOption.id]
      );
    } else {
      setCustomTopics((previous) => {
        if (
          selectedIds.length + previous.length >=
          AGENT_PROTOCOL_LIMITS.topicCount
        ) {
          return previous;
        }
        return previous.some(
          (existing) =>
            existing.toLocaleLowerCase() === topic.toLocaleLowerCase()
        )
          ? previous
          : [...previous, topic];
      });
    }
    setCustomInputOpen(false);
  }, [component.options, customDraft, customTopics.length, selectedIds.length]);

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
        <YStack
          width="100%"
          borderWidth={1}
          borderColor="$border"
          borderRadius="$m"
          overflow="hidden"
        >
          {component.options.map((option, index) => {
            const isSelected = completed
              ? completedOptionLabels.has(option.label)
              : selectedIds.includes(option.id);
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
        {component.freeTextPlaceholder || displayedCustomTopics.length ? (
          <A2UIMenuRow
            testID="A2UISmallChoiceCustom"
            accessibilityLabel={
              displayedCustomTopics.length
                ? `Edit custom topics: ${displayedCustomTopicSummary}`
                : `Add ${customChoiceLabel}`
            }
            accessibilityState={{ disabled }}
            disabled={disabled}
            onPress={openCustomInput}
            bordered
            dimmed={disabled && !displayedCustomTopics.length}
            label={
              displayedCustomTopics.length
                ? displayedCustomTopicSummary
                : customChoiceLabel
            }
            labelColor={
              displayedCustomTopics.length ? '$primaryText' : '$secondaryText'
            }
            leading={
              <View
                width={28}
                height={28}
                borderRadius="$s"
                backgroundColor={
                  displayedCustomTopics.length
                    ? '$primaryText'
                    : '$secondaryBackground'
                }
                alignItems="center"
                justifyContent="center"
                flexShrink={0}
              >
                {displayedCustomTopics.length ? (
                  <Text size="$label/s" color="$background" trimmed={false}>
                    {displayedCustomTopics.length}
                  </Text>
                ) : (
                  <Icon
                    type="Add"
                    color="$secondaryText"
                    customSize={[14, 14]}
                  />
                )}
              </View>
            }
            trailing={
              displayedCustomTopics.length ? (
                <Icon
                  type="Checkmark"
                  color="$primaryText"
                  customSize={[16, 16]}
                />
              ) : null
            }
          />
        ) : null}
        <A2UIMenuRow
          testID="A2UISmallChoiceSubmit"
          accessibilityLabel={component.submitLabel}
          accessibilityState={{ disabled: submitDisabled }}
          disabled={submitDisabled}
          onPress={handleSubmit}
          bordered
          dimmed={submitDisabled}
          prominent={hasSelection}
          label={component.submitLabel}
          trailing={
            <Icon
              type="Checkmark"
              color={hasSelection ? '$background' : '$primaryText'}
              customSize={[16, 16]}
            />
          }
        />
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
                // Echoing a controlled value back mid-IME-composition
                // duplicates the composed text on Android (stale
                // mostRecentEventCount), so native stays uncontrolled; the
                // sheet unmounts on close, so each open starts empty.
                value={isWeb ? customDraft : undefined}
                onChangeText={setCustomDraft}
                maxLength={AGENT_PROTOCOL_LIMITS.topicLength}
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
    case 'Divider':
      return '';
  }
}

export function A2UIBlock({
  block,
  ...props
}: { block: A2UIBlockData } & ComponentProps<typeof YStack>) {
  const {
    a2uiSourcePostId,
    areA2UISelectionsPending,
    canSendA2UIResponse,
    getConsumedA2UISelection,
    isA2UIActionAvailable,
    onA2UIAction,
  } = useContentContext();
  const [locallyConsumedComponentIds, setLocallyConsumedComponentIds] =
    useState<string[]>([]);
  const [locallyConsumedChoices, setLocallyConsumedChoices] = useState<
    Record<string, string>
  >({});
  const buttonPressLocksRef = useRef(new Set<string>());
  const choicePressLocksRef = useRef(new Set<string>());
  const smallChoiceSubmitLocksRef = useRef(new Set<string>());
  const update = A2UI.getUpdateMessage(block.a2ui);
  const root = A2UI.getRootComponentId(block.a2ui);
  const surfaceId =
    A2UI.getCreateMessage(block.a2ui)?.createSurface.surfaceId ??
    'unknown-surface';
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
        buttonPressLocksRef.current.has(component.id) ||
        (component.action.event.name === A2UI.action.sendMessage &&
          !component.action.event.context.text.trim())
      ) {
        return;
      }

      const consumeAction = isConsumableA2UIAction(component.action);
      buttonPressLocksRef.current.add(component.id);
      try {
        await onA2UIAction?.(
          component.action,
          consumeAction
            ? buildActionSelection(
                a2uiSourcePostId,
                surfaceId,
                component.id,
                component.action
              )
            : undefined
        );
        if (consumeAction) {
          setLocallyConsumedComponentIds((previous) =>
            previous.includes(component.id)
              ? previous
              : [...previous, component.id]
          );
        }
      } catch {
        buttonPressLocksRef.current.delete(component.id);
      } finally {
        if (!consumeAction) {
          buttonPressLocksRef.current.delete(component.id);
        }
      }
    },
    [a2uiSourcePostId, onA2UIAction, surfaceId]
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
        await onA2UIAction?.(
          action,
          consumeAction
            ? buildActionSelection(
                a2uiSourcePostId,
                surfaceId,
                componentId,
                action,
                optionId
              )
            : undefined
        );
      } catch {
        choicePressLocksRef.current.delete(componentId);
        if (consumeAction) {
          durableConsumptionObservedRef.current.delete(componentId);
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
    [a2uiSourcePostId, onA2UIAction, surfaceId]
  );

  const handleSmallChoiceSubmit = useCallback(
    async (
      action: A2UI.ButtonAction,
      selection: PostBlobDataEntryA2UISelection
    ) => {
      const componentId = selection.componentId;
      if (smallChoiceSubmitLocksRef.current.has(componentId)) {
        throw new Error('A2UI SmallChoice submission is already in progress');
      }
      smallChoiceSubmitLocksRef.current.add(componentId);
      try {
        await onA2UIAction?.(action, selection);
      } catch (error) {
        smallChoiceSubmitLocksRef.current.delete(componentId);
        throw error;
      }
    },
    [onA2UIAction]
  );

  const durableConsumptionObservedRef = useRef(new Set<string>());
  useEffect(() => {
    const localIds = new Set([
      ...locallyConsumedComponentIds,
      ...Object.keys(locallyConsumedChoices),
      ...smallChoiceSubmitLocksRef.current,
    ]);
    const deletedIds: string[] = [];

    localIds.forEach((componentId) => {
      if (getConsumedA2UISelection?.(surfaceId, componentId)) {
        durableConsumptionObservedRef.current.add(componentId);
      } else if (durableConsumptionObservedRef.current.has(componentId)) {
        durableConsumptionObservedRef.current.delete(componentId);
        buttonPressLocksRef.current.delete(componentId);
        choicePressLocksRef.current.delete(componentId);
        smallChoiceSubmitLocksRef.current.delete(componentId);
        deletedIds.push(componentId);
      }
    });

    if (!deletedIds.length) return;
    const deleted = new Set(deletedIds);
    setLocallyConsumedComponentIds((current) =>
      current.filter((componentId) => !deleted.has(componentId))
    );
    setLocallyConsumedChoices((current) =>
      Object.fromEntries(
        Object.entries(current).filter(
          ([componentId]) => !deleted.has(componentId)
        )
      )
    );
  }, [
    getConsumedA2UISelection,
    locallyConsumedChoices,
    locallyConsumedComponentIds,
    surfaceId,
  ]);

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
          const consumptionPending =
            actionCanBeConsumed && areA2UISelectionsPending;
          const actionConsumed =
            actionCanBeConsumed &&
            (locallyConsumedComponentIds.includes(component.id) ||
              Boolean(getConsumedA2UISelection?.(surfaceId, component.id)));
          const disabled =
            actionConsumed ||
            consumptionPending ||
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
          const durableSelection = getConsumedA2UISelection?.(
            surfaceId,
            component.id
          );
          const selectedOption =
            component.options.find(
              (option) => option.id === locallyConsumedChoices[component.id]
            ) ??
            (durableSelection
              ? component.options.find(
                  (option) => option.id === durableSelection.optionId
                )
              : undefined);
          const choiceConsumed =
            Boolean(selectedOption) || Boolean(durableSelection);
          const grouped = component.options.length > 1;
          const compact =
            grouped &&
            component.options.every(
              (option) => !option.icon && !option.description
            );
          const choices = component.options.map((option, index) => {
            const accent = CHOICE_ACCENT_COLORS[option.accent ?? 'neutral'];
            const isSelected = selectedOption?.id === option.id;
            // The accent is normally carried by the icon chip. An option
            // that asks for one without an icon would otherwise render
            // identically to a neutral card — the accent silently doing
            // nothing — so let the card itself carry it instead. A single
            // accented card in a message reads as the thing to tap; the
            // multi-option pickers all have icons and are untouched.
            const accentedCard = Boolean(
              option.accent && option.accent !== 'neutral' && !option.icon
            );
            const consumptionPending =
              isConsumableA2UIAction(option.action) && areA2UISelectionsPending;
            const disabled =
              choiceConsumed ||
              consumptionPending ||
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
                  isSelected={isSelected}
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
                accessibilityState={{ disabled, selected: isSelected }}
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
                  opacity={disabled && !isSelected ? 0.5 : 1}
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
                  {isSelected ? (
                    <Icon
                      type="Checkmark"
                      color="$primaryText"
                      customSize={[16, 16]}
                    />
                  ) : null}
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
              {grouped ? (
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
                canSend={
                  Boolean(onA2UIAction) &&
                  canSendA2UIResponse !== false &&
                  !(
                    isConsumableA2UIAction(component.action) &&
                    areA2UISelectionsPending
                  ) &&
                  (component.action.event.name !== A2UI.action.provisionAgent ||
                    isA2UIActionAvailable?.(component.action) !== false)
                }
                consumedSelection={getConsumedA2UISelection?.(
                  surfaceId,
                  component.id
                )}
                onSubmit={handleSmallChoiceSubmit}
                sourcePostId={a2uiSourcePostId}
                surfaceId={surfaceId}
              />
            </YStack>
          );
        }
      }
    },
    [
      a2uiSourcePostId,
      areA2UISelectionsPending,
      canSendA2UIResponse,
      components,
      getConsumedA2UISelection,
      handleButtonPress,
      handleChoicePress,
      handleSmallChoiceSubmit,
      isA2UIActionAvailable,
      locallyConsumedComponentIds,
      locallyConsumedChoices,
      onA2UIAction,
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
