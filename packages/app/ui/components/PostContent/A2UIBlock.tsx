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
import { KeyboardController } from 'react-native-keyboard-controller';
import { View, XStack, YStack, isWeb } from 'tamagui';

import { useConversationScrollEndAnchor } from '../../contexts/scroll';
import { ActionSheet } from '../ActionSheet';
import { resolveAgentProvisionButtonLabel } from '../ChatMessage/agentProvision';
import { TextInput } from '../Form';
import { A2UIMenuRow } from './A2UIMenuRow';
import { shouldDismissKeyboardForChoice } from './a2uiActionConsumption';
import {
  A2UICardButton,
  A2UIChoiceIndicator,
  A2UIOptionCard,
  A2UI_CARD_PADDING,
  A2UI_CARD_PADDING_TOP,
  A2UI_CARD_RADIUS,
  A2UI_INNER_CARD,
  A2UI_OPTION_ROW_HEIGHT,
  A2UI_OPTION_ROW_PADDING,
  A2UI_SPACE,
  A2UI_TEXT_BREAKING,
  A2UI_TYPE,
  getA2UICardButtonStyle,
} from './a2uiCardParts';
import {
  AGENT_TASK_PLAN_AUTO_PROVISION_COMPONENT_ID,
  claimAutomaticProvisionRetry,
  clearFailedAutomaticProvision,
  isComponentReachableFromRoot,
  shouldAttemptAutomaticProvision,
  trackAutomaticProvisionReceipt,
} from './autoProvision';
import { McpConnectControl } from './McpConnectControl';
import { useContentContext } from './contentUtils';
import { useOneShotAction } from './useOneShotAction';

type RenderOptions = {
  cardDepth?: number;
  /** Space above this component, from its column's rhythm. */
  spacingTop?: number;
  /** A button sharing a row of buttons takes an equal width. */
  fillRow?: boolean;
  /** A row of more buttons than fit on one line wraps them two to a line. */
  pairRow?: boolean;
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
/** The most equal-width buttons a card's button row holds on one line. */
const MAX_BUTTONS_PER_LINE = 3;

function isConsumableA2UIAction(action: A2UI.ButtonAction) {
  return (
    action.event.name === A2UI.action.sendMessage ||
    action.event.name === A2UI.action.requestCreditIncrease ||
    action.event.name === A2UI.action.provisionAgent
  );
}

/**
 * The durable record an owner-response action leaves on the post it creates.
 * Undefined for actions without a chat response; those use their own state.
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
  accessibilityRole,
  accessibilityValue,
  disabled,
  indicator = 'circle',
  isLast,
  isSelected,
  label,
  onPress,
  testID,
}: {
  accessibilityRole?: ComponentProps<typeof A2UIMenuRow>['accessibilityRole'];
  accessibilityValue?: ComponentProps<typeof A2UIMenuRow>['accessibilityValue'];
  disabled: boolean;
  /** A circle when one answer is allowed, a square when several are. */
  indicator?: 'circle' | 'square';
  isLast: boolean;
  isSelected: boolean;
  label: string;
  onPress: () => void;
  testID: string;
}) {
  // Tamagui's compiler can drop inline ternaries on token-valued props.
  const fill = isSelected ? '$secondaryBackground' : '$background';
  return (
    <A2UIMenuRow
      testID={testID}
      accessibilityLabel={label}
      accessibilityRole={accessibilityRole}
      accessibilityState={{ disabled, selected: isSelected }}
      accessibilityValue={accessibilityValue}
      disabled={disabled}
      onPress={onPress}
      dividerAfter={!isLast}
      dimmed={disabled && !isSelected}
      backgroundColor={fill}
      label={label}
      labelCanWrap
      labelWeight={isSelected ? '500' : undefined}
      minHeight={A2UI_OPTION_ROW_HEIGHT}
      paddingVertical={8}
      leading={<A2UIChoiceIndicator selected={isSelected} shape={indicator} />}
    />
  );
}

/**
 * A compact questionnaire for selecting one or several short answers.
 * Selection is local until submit — no per-tap posting — so it lives in a
 * child component with its own state rather than in the render callback.
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
  const customInputMountedRef = useRef(true);
  const customInputOpenRef = useRef(false);
  const conversationScrollEndAnchor = useConversationScrollEndAnchor();
  const oneShot = useOneShotAction(Boolean(consumedSelection));
  const isSingleSelect = component.selectionMode === 'single';

  const setCustomInputVisibility = useCallback(
    (open: boolean) => {
      customInputOpenRef.current = open;
      if (open) {
        conversationScrollEndAnchor?.capture();
        setCustomInputOpen(true);
        return;
      }

      setCustomInputOpen(false);
      void KeyboardController.dismiss().finally(() => {
        if (customInputMountedRef.current && !customInputOpenRef.current) {
          requestAnimationFrame(() => {
            conversationScrollEndAnchor?.restore();
          });
        }
      });
    },
    [conversationScrollEndAnchor]
  );

  useEffect(
    () => () => {
      customInputMountedRef.current = false;
    },
    []
  );

  useEffect(() => {
    if (!shouldDismissKeyboardForChoice(canSend, Boolean(consumedSelection))) {
      return;
    }
    // A choice is the next interaction after an owner message. Keep the
    // composer's keyboard from covering half the newly arrived options while
    // still allowing the first tap on a row to select it.
    void KeyboardController.dismiss();
  }, [canSend, consumedSelection]);

  const toggle = useCallback(
    (id: string) => {
      if (oneShot.isLocked()) {
        return;
      }
      if (isSingleSelect) {
        setCustomTopics([]);
        setSelectedIds((previous) => (previous.includes(id) ? [] : [id]));
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
    [customTopics.length, isSingleSelect, oneShot]
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
    if (!hasValidSelection || oneShot.isLocked()) {
      return;
    }
    await oneShot.run(() =>
      onSubmit(actionForSelection, {
        type: 'tlon-a2ui-selection',
        version: 1,
        sourcePostId,
        surfaceId,
        componentId: component.id,
        clientTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        values: valuesForSelection,
      })
    );
  }, [
    actionForSelection,
    component.id,
    hasValidSelection,
    onSubmit,
    oneShot,
    sourcePostId,
    surfaceId,
    valuesForSelection,
  ]);

  const completed = oneShot.consumed;
  const disabled = oneShot.pending || completed || !canSend;
  const submitDisabled = disabled || !hasValidSelection;
  const customChoiceLabel =
    component.freeTextPlaceholder?.replace(/…+$/, '') || '';
  const completedTopics = oneShot.consumedLocally
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

  const openCustomInput = useCallback(() => {
    if (oneShot.isLocked()) {
      return;
    }
    setCustomDraft('');
    setCustomInputVisibility(true);
  }, [oneShot, setCustomInputVisibility]);

  const closeSavedCustomInput = useCallback(() => {
    customInputOpenRef.current = false;
    void KeyboardController.dismiss().finally(() => {
      if (!customInputMountedRef.current || customInputOpenRef.current) {
        return;
      }

      // Keep the sheet over the conversation until its keyboard has fully
      // settled. Closing it first exposes the floating composer's native
      // bottom-edge effect while it still has keyboard-sized geometry, and a
      // scroll-to-end during that transition anchors against the wrong inset.
      conversationScrollEndAnchor?.restore();
      requestAnimationFrame(() => {
        if (customInputMountedRef.current && !customInputOpenRef.current) {
          setCustomInputOpen(false);
        }
      });
    });
  }, [conversationScrollEndAnchor]);

  const saveCustomInput = useCallback(() => {
    if (oneShot.isLocked()) {
      return;
    }
    const topic = customDraft.trim();
    if (!topic) return;

    const matchingOption = component.options.find(
      (option) => option.label.toLocaleLowerCase() === topic.toLocaleLowerCase()
    );
    if (matchingOption) {
      if (isSingleSelect) {
        setCustomTopics([]);
        setSelectedIds([matchingOption.id]);
        closeSavedCustomInput();
        return;
      }
      setSelectedIds((previous) =>
        previous.includes(matchingOption.id) ||
        previous.length + customTopics.length >=
          AGENT_PROTOCOL_LIMITS.topicCount
          ? previous
          : [...previous, matchingOption.id]
      );
    } else {
      if (isSingleSelect) {
        setSelectedIds([]);
        setCustomTopics([topic]);
        closeSavedCustomInput();
        return;
      }
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
    closeSavedCustomInput();
  }, [
    closeSavedCustomInput,
    component.options,
    customDraft,
    customTopics.length,
    isSingleSelect,
    oneShot,
    selectedIds.length,
  ]);

  const removeCustomTopic = useCallback(
    (topic: string) => {
      if (oneShot.isLocked()) {
        return;
      }
      setCustomTopics((previous) =>
        previous.filter((existing) => existing !== topic)
      );
    },
    [oneShot]
  );

  const hasCustomRow = Boolean(
    component.freeTextPlaceholder || displayedCustomTopics.length
  );
  const card = (
    <A2UIOptionCard
      footer={
        <A2UICardButton
          testID="A2UISmallChoiceSubmit"
          tone="primary"
          label={component.submitLabel}
          disabled={submitDisabled}
          onPress={handleSubmit}
        />
      }
    >
      <YStack width="100%">
        {component.options.map((option, index) => {
          const isSelected = completed
            ? completedOptionLabels.has(option.label)
            : selectedIds.includes(option.id);
          return (
            <SmallChoiceRow
              key={option.id}
              indicator={isSingleSelect ? 'circle' : 'square'}
              testID={`A2UISmallChoice-${option.id}`}
              label={option.label}
              accessibilityRole={isSingleSelect ? 'radio' : 'checkbox'}
              accessibilityValue={{
                text: isSelected ? 'Selected' : 'Not selected',
              }}
              isSelected={isSelected}
              // The custom row sits below the last option when there is one.
              isLast={!hasCustomRow && index === component.options.length - 1}
              disabled={disabled}
              onPress={() => toggle(option.id)}
            />
          );
        })}
        {hasCustomRow ? (
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
            dimmed={disabled && !displayedCustomTopics.length}
            backgroundColor={
              displayedCustomTopics.length ? '$secondaryBackground' : undefined
            }
            label={
              displayedCustomTopics.length
                ? displayedCustomTopicSummary
                : customChoiceLabel
            }
            labelCanWrap
            labelColor={
              displayedCustomTopics.length ? '$primaryText' : '$secondaryText'
            }
            labelWeight={displayedCustomTopics.length ? '500' : undefined}
            minHeight={A2UI_OPTION_ROW_HEIGHT}
            paddingVertical={8}
            leading={
              displayedCustomTopics.length ? (
                <A2UIChoiceIndicator
                  selected
                  shape={isSingleSelect ? 'circle' : 'square'}
                />
              ) : (
                <View
                  width={20}
                  height={20}
                  alignItems="center"
                  justifyContent="center"
                  flexShrink={0}
                >
                  <Icon
                    type="Add"
                    color="$secondaryText"
                    customSize={[16, 16]}
                  />
                </View>
              )
            }
          />
        ) : null}
      </YStack>
    </A2UIOptionCard>
  );

  return (
    <>
      {card}
      {component.freeTextPlaceholder ? (
        <ActionSheet
          moveOnKeyboardChange
          modal
          open={customInputOpen}
          onOpenChange={setCustomInputVisibility}
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
                        // Matches the input's text inset below.
                        paddingHorizontal="$xl"
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

function getTextStyle(component: A2UI.Text) {
  // One title size for every heading level below h1; h5 reads as an
  // emphasised label. h1 keeps the app's display size.
  switch (component.variant) {
    case 'h1':
      return undefined;
    case 'h2':
    case 'h3':
    case 'h4':
      return A2UI_TYPE.title;
    case 'h5':
      return A2UI_TYPE.labelStrong;
    case 'caption':
      return A2UI_TYPE.note;
    default:
      return A2UI_TYPE.body;
  }
}

function isHeading(component: A2UI.Component | undefined) {
  return (
    component?.component === 'Text' &&
    (component.variant === 'h1' ||
      component.variant === 'h2' ||
      component.variant === 'h3' ||
      component.variant === 'h4')
  );
}

/** A row of two or more buttons and nothing else: a card's answers. */
function isButtonRow(
  component: A2UI.Component | undefined,
  components: Map<string, A2UI.Component>
) {
  return (
    component?.component === 'Row' &&
    component.children.length > 1 &&
    component.children.every(
      (child) => components.get(child)?.component === 'Button'
    )
  );
}

/** Space above a column child, following the design's rhythm. */
function getStackSpacing(
  previous: A2UI.Component | undefined,
  current: A2UI.Component | undefined,
  components: Map<string, A2UI.Component>,
  inInnerCard: boolean
) {
  if (!previous || !current) return 0;
  if (isButtonRow(current, components)) {
    return inInnerCard
      ? A2UI_SPACE.beforeInnerButtons
      : A2UI_SPACE.beforeButtons;
  }
  // A short line before a heading is its kicker.
  if (isHeading(current) && previous.component === 'Text') {
    return A2UI_SPACE.afterKicker;
  }
  if (isHeading(previous)) return A2UI_SPACE.afterTitle;
  if (previous.component === 'Card' && current.component === 'Card') {
    return A2UI_SPACE.betweenInnerCards;
  }
  if (previous.component === 'Text' && current.component === 'Text') {
    return A2UI_SPACE.line;
  }
  return A2UI_SPACE.block;
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
    return component.component === 'Row' ? 6 : 4;
  }

  return 8;
}

function hasButtonChild(
  component: A2UI.Container,
  components: Map<string, A2UI.Component>
) {
  return component.children.some(
    (child) => components.get(child)?.component === 'Button'
  );
}

function isPrimaryButton(component: A2UI.Button) {
  return (
    component.variant === 'primary' ||
    component.action.event.name === A2UI.action.requestCreditIncrease
  );
}

function getButtonTreatment(component: A2UI.Button, inButtonRow: boolean) {
  // Buttons sharing a row all get a surface, so a borderless answer such as
  // Block reads as one of the choices rather than a stray link.
  return getA2UICardButtonStyle(
    isPrimaryButton(component)
      ? 'primary'
      : component.variant === 'borderless' && !inButtonRow
        ? 'borderless'
        : 'secondary'
  );
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
    a2uiSourcePostId,
    areA2UISelectionsPending,
    canSendA2UIResponse,
    canUseAgentProviderControls,
    consumedA2UIMessageText,
    getConfiguredAgentProviderIds,
    getConsumedA2UISelection,
    isA2UIActionAvailable,
    isA2UIActionConsumed,
    onA2UIAction,
    provisionedAgentTopics,
  } = useContentContext();
  const [locallyConsumedComponentIds, setLocallyConsumedComponentIds] =
    useState<string[]>([]);
  const [locallyConsumedChoices, setLocallyConsumedChoices] = useState<
    Record<string, string>
  >({});
  const [pendingButtonIds, setPendingButtonIds] = useState<string[]>([]);
  const [failedAutoProvisionSurfaceIds, setFailedAutoProvisionSurfaceIds] =
    useState<string[]>([]);
  const buttonPressLocksRef = useRef(new Set<string>());
  const autoProvisionAttemptsRef = useRef(new Set<string>());
  const observedAutoProvisionReceiptsRef = useRef(new Set<string>());
  const autoProvisionRetryLocksRef = useRef(new Set<string>());
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
        return false;
      }

      const consumeAction = isConsumableA2UIAction(component.action);
      buttonPressLocksRef.current.add(component.id);
      setPendingButtonIds((previous) =>
        previous.includes(component.id) ? previous : [...previous, component.id]
      );
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
        if (component.id === AGENT_TASK_PLAN_AUTO_PROVISION_COMPONENT_ID) {
          setFailedAutoProvisionSurfaceIds((previous) =>
            clearFailedAutomaticProvision(previous, surfaceId)
          );
        }
        return true;
      } catch (error) {
        console.error('A2UI button action failed', error);
        buttonPressLocksRef.current.delete(component.id);
        return false;
      } finally {
        setPendingButtonIds((previous) =>
          previous.filter((componentId) => componentId !== component.id)
        );
        if (!consumeAction) {
          buttonPressLocksRef.current.delete(component.id);
        }
      }
    },
    [a2uiSourcePostId, onA2UIAction, surfaceId]
  );

  useEffect(() => {
    const component = components.get(
      AGENT_TASK_PLAN_AUTO_PROVISION_COMPONENT_ID
    );
    if (!component || component.component !== 'Button' || !onA2UIAction) {
      return;
    }
    if (
      !shouldAttemptAutomaticProvision({
        componentId: component.id,
        actionName: component.action.event.name,
        componentReachable: isComponentReachableFromRoot(
          root,
          component.id,
          components
        ),
        componentDisabled: component.disabled === true,
        selectionsPending: Boolean(areA2UISelectionsPending),
        actionAvailable: isA2UIActionAvailable?.(component.action) !== false,
        consumed: Boolean(
          getConsumedA2UISelection?.(surfaceId, component.id) ||
          isA2UIActionConsumed?.(component.action) === true
        ),
        attemptedThisMount:
          autoProvisionAttemptsRef.current.has(surfaceId) ||
          observedAutoProvisionReceiptsRef.current.has(surfaceId) ||
          failedAutoProvisionSurfaceIds.includes(surfaceId),
      })
    ) {
      return;
    }

    // This is the automatic handoff from a completed model interview to the
    // existing owner-authenticated provision coordinator. One mount makes one
    // attempt; durable selection/provision receipts suppress remount retries.
    autoProvisionAttemptsRef.current.add(surfaceId);
    void handleButtonPress(component).then((succeeded) => {
      if (!succeeded) {
        setFailedAutoProvisionSurfaceIds((previous) =>
          previous.includes(surfaceId) ? previous : [...previous, surfaceId]
        );
      }
    });
  }, [
    areA2UISelectionsPending,
    components,
    failedAutoProvisionSurfaceIds,
    getConsumedA2UISelection,
    handleButtonPress,
    isA2UIActionAvailable,
    isA2UIActionConsumed,
    onA2UIAction,
    root,
    surfaceId,
  ]);

  useEffect(() => {
    const component = components.get(
      AGENT_TASK_PLAN_AUTO_PROVISION_COMPONENT_ID
    );
    if (!component || component.component !== 'Button') {
      return;
    }
    const consumed = Boolean(
      getConsumedA2UISelection?.(surfaceId, component.id) ||
      isA2UIActionConsumed?.(component.action) === true
    );
    const transition = trackAutomaticProvisionReceipt({
      observedReceipts: observedAutoProvisionReceiptsRef.current,
      activeAttempts: autoProvisionAttemptsRef.current,
      surfaceId,
      consumed,
    });
    if (transition === 'failed') {
      buttonPressLocksRef.current.delete(component.id);
      setFailedAutoProvisionSurfaceIds((previous) =>
        previous.includes(surfaceId) ? previous : [...previous, surfaceId]
      );
    }
  }, [components, getConsumedA2UISelection, isA2UIActionConsumed, surfaceId]);

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
              size={component.variant === 'h1' ? '$title/l' : '$label/l'}
              {...getTextStyle(component)}
              color={getTextColor(component)}
              trimmed={false}
              textAlign={getTextAlign(options.parentAlign)}
              flex={getComponentFlex(component)}
              marginTop={options.spacingTop}
              {...A2UI_TEXT_BREAKING}
            >
              {component.text}
            </Text>
          );
        }
        case 'Row': {
          // A row made only of buttons is a footer. The buttons share the
          // width equally, with the primary one last.
          const buttonFooter =
            component.children.length > 1 &&
            component.children.every(
              (child) => components.get(child)?.component === 'Button'
            );
          // Past three, equal-width buttons get too narrow for their labels
          // (the pending-approvals card sends four), so they pair up.
          const pairButtons =
            buttonFooter && component.children.length > MAX_BUTTONS_PER_LINE;
          const children = buttonFooter
            ? [...component.children].sort((a, b) => {
                const aButton = components.get(a);
                const bButton = components.get(b);
                const aPrimary =
                  aButton?.component === 'Button' && isPrimaryButton(aButton);
                const bPrimary =
                  bButton?.component === 'Button' && isPrimaryButton(bButton);
                return Number(aPrimary) - Number(bPrimary);
              })
            : component.children;
          return (
            <XStack
              key={component.id}
              gap={buttonFooter ? 8 : getComponentGap(component, components)}
              marginTop={
                options.spacingTop ??
                (hasButtonChild(component, components) ? 16 : undefined)
              }
              alignItems={getAlignItems(component.align)}
              justifyContent={getJustifyContent(component.justify)}
              flexWrap={buttonFooter && !pairButtons ? 'nowrap' : 'wrap'}
              width="100%"
              flex={getComponentFlex(component)}
            >
              {children.map((child, index) =>
                renderComponent(child, {
                  cardDepth: options.cardDepth,
                  fillRow: buttonFooter,
                  pairRow: pairButtons,
                  parentAlign: component.align,
                  standaloneControlTopMargin:
                    !options.cardDepth &&
                    index > 0 &&
                    components.get(children[index - 1])?.component === 'Text' &&
                    components.get(child)?.component === 'Button',
                })
              )}
            </XStack>
          );
        }
        case 'Column': {
          // Spacing comes from each child's place in the design's rhythm,
          // not one gap for the whole column.
          const inInnerCard = (options.cardDepth ?? 0) >= 2;
          return (
            <YStack
              key={component.id}
              alignItems={getAlignItems(component.align, 'stretch')}
              justifyContent={getJustifyContent(component.justify)}
              flex={getComponentFlex(component)}
              marginTop={options.spacingTop}
            >
              {component.children.map((child, index) =>
                renderComponent(child, {
                  cardDepth: options.cardDepth,
                  parentAlign: component.align,
                  spacingTop: getStackSpacing(
                    index > 0
                      ? components.get(component.children[index - 1])
                      : undefined,
                    components.get(child),
                    components,
                    inInnerCard
                  ),
                })
              )}
            </YStack>
          );
        }
        case 'Card': {
          const isNestedCard = Boolean(options.cardDepth);
          // One white surface with a hairline edge. A nested card is the
          // bordered inner card holding what a request is about.
          return (
            <YStack
              key={component.id}
              borderWidth={1}
              borderColor="$border"
              borderRadius={
                isNestedCard ? A2UI_INNER_CARD.radius : A2UI_CARD_RADIUS
              }
              backgroundColor="$background"
              paddingHorizontal={
                isNestedCard ? A2UI_INNER_CARD.paddingX : A2UI_CARD_PADDING
              }
              paddingTop={
                isNestedCard ? A2UI_INNER_CARD.paddingY : A2UI_CARD_PADDING_TOP
              }
              paddingBottom={
                isNestedCard ? A2UI_INNER_CARD.paddingY : A2UI_CARD_PADDING
              }
              marginTop={options.spacingTop}
              flex={getComponentFlex(component)}
              width="100%"
              alignSelf="stretch"
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
              marginTop={options.spacingTop}
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
              Boolean(getConsumedA2UISelection?.(surfaceId, component.id)) ||
              isA2UIActionConsumed?.(component.action) === true);
          const disabled =
            pendingButtonIds.includes(component.id) ||
            actionConsumed ||
            consumptionPending ||
            component.disabled ||
            !onA2UIAction ||
            isA2UIActionAvailable?.(component.action) === false;
          const label =
            actionConsumed && component.consumedLabel
              ? component.consumedLabel
              : getComponentText(components.get(component.child), components);
          const treatment = getButtonTreatment(
            component,
            Boolean(options.fillRow)
          );
          const visibleLabel =
            component.action.event.name === A2UI.action.provisionAgent
              ? resolveAgentProvisionButtonLabel(
                  label,
                  pendingButtonIds.includes(component.id),
                  actionConsumed
                )
              : label;
          const fillsRow = Boolean(
            options.fillRow && component.weight === undefined
          );
          const inInnerCard = (options.cardDepth ?? 0) >= 2;
          return (
            <Button.Frame
              key={component.id}
              size="medium"
              fill={treatment.fill}
              intent={treatment.intent}
              {...(treatment.surface
                ? {
                    backgroundColor: treatment.surface,
                    borderColor: treatment.surface,
                  }
                : null)}
              alignSelf={
                fillsRow
                  ? 'stretch'
                  : options.parentAlign === 'center'
                    ? 'center'
                    : 'flex-start'
              }
              marginTop={
                options.spacingTop ??
                (component.action.event.name ===
                A2UI.action.requestCreditIncrease
                  ? 24
                  : options.standaloneControlTopMargin
                    ? CHOICE_CONTROL_OUTER_MARGIN
                    : undefined)
              }
              // Buttons inside an inner card, such as one pending request's
              // answers, are a size smaller.
              height={inInnerCard ? 36 : 44}
              borderRadius={inInnerCard ? 10 : 12}
              paddingHorizontal={fillsRow ? 8 : 16}
              {...(fillsRow && options.pairRow
                ? // Two to a line: 40% each plus the gap leaves no room for a third.
                  { flexGrow: 1, flexShrink: 0, flexBasis: '40%' }
                : { flex: fillsRow ? 1 : getComponentFlex(component) })}
              opacity={actionConsumed ? 0.5 : 1}
              pointerEvents={actionConsumed ? 'none' : 'auto'}
              accessibilityElementsHidden={false}
              importantForAccessibility="auto"
              disabled={disabled}
              dimmed={disabled}
              accessibilityRole="button"
              accessibilityLabel={visibleLabel}
              testID={`A2UIButton-${component.id}`}
              onPress={
                disabled ? undefined : () => handleButtonPress(component)
              }
            >
              <Button.Text
                size="medium"
                {...A2UI_TYPE.labelStrong}
                numberOfLines={fillsRow ? 1 : undefined}
              >
                {visibleLabel}
              </Button.Text>
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
              : undefined) ??
            component.options.find(
              (option) =>
                option.action.event.name === A2UI.action.sendMessage &&
                option.action.event.context.text.trim() ===
                  consumedA2UIMessageText?.trim()
            );
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
                  isSelected={isSelected}
                  isLast={isLast}
                  disabled={disabled}
                  onPress={() =>
                    handleChoicePress(component.id, option.id, option.action)
                  }
                />
              );
            }
            // Several options are rows in one card; a single option is a
            // card of its own.
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
                  minHeight={A2UI_OPTION_ROW_HEIGHT}
                  borderWidth={grouped ? 0 : accentedCard ? 2 : 1}
                  borderBottomWidth={grouped ? (isLast ? 0 : 1) : undefined}
                  borderColor={accentedCard ? accent.strong : '$border'}
                  borderBottomColor="$border"
                  borderRadius={grouped ? 0 : A2UI_CARD_RADIUS}
                  backgroundColor="$background"
                  paddingVertical={12}
                  paddingHorizontal={A2UI_OPTION_ROW_PADDING}
                  gap={12}
                  alignItems="center"
                  opacity={disabled && !isSelected ? 0.5 : 1}
                >
                  {option.icon ? (
                    <View
                      width={32}
                      height={32}
                      borderRadius={9}
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
                  <YStack flex={1} minWidth={0}>
                    <Text
                      size="$label/l"
                      {...A2UI_TYPE.labelStrong}
                      trimmed={false}
                      {...A2UI_TEXT_BREAKING}
                    >
                      {option.label}
                    </Text>
                    {option.description ? (
                      <Text
                        size="$label/m"
                        {...A2UI_TYPE.note}
                        color="$secondaryText"
                        trimmed={false}
                        {...A2UI_TEXT_BREAKING}
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
              marginTop={options.spacingTop ?? CHOICE_CONTROL_OUTER_MARGIN}
            >
              {grouped ? <A2UIOptionCard>{choices}</A2UIOptionCard> : choices}
            </YStack>
          );
        }
        case 'SmallChoice': {
          const durableSelection = getConsumedA2UISelection?.(
            surfaceId,
            component.id
          );
          const provisionSelection =
            component.action.event.name === A2UI.action.provisionAgent &&
            isA2UIActionConsumed?.(component.action) === true &&
            provisionedAgentTopics?.length
              ? {
                  type: 'tlon-a2ui-selection' as const,
                  version: 1 as const,
                  surfaceId,
                  componentId: component.id,
                  values: provisionedAgentTopics,
                }
              : undefined;
          return (
            <YStack
              key={component.id}
              width="100%"
              marginTop={options.spacingTop ?? CHOICE_CONTROL_OUTER_MARGIN}
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
                consumedSelection={durableSelection ?? provisionSelection}
                onSubmit={handleSmallChoiceSubmit}
                sourcePostId={a2uiSourcePostId}
                surfaceId={surfaceId}
              />
            </YStack>
          );
        }
        case 'McpConnect':
          if (!canUseAgentProviderControls) return null;
          return (
            <YStack
              key={component.id}
              width="100%"
              marginTop={options.spacingTop ?? CHOICE_CONTROL_OUTER_MARGIN}
            >
              <McpConnectControl
                component={component}
                selectionsPending={areA2UISelectionsPending}
                surfaceId={surfaceId}
                configuredProviderIds={getConfiguredAgentProviderIds?.(
                  component.configureAction
                )}
                completionConsumed={Boolean(
                  component.completionAction &&
                  (getConsumedA2UISelection?.(surfaceId, component.id) ||
                    isA2UIActionConsumed?.(component.completionAction))
                )}
                completionSelection={
                  component.completionAction
                    ? buildActionSelection(
                        a2uiSourcePostId,
                        surfaceId,
                        component.id,
                        component.completionAction
                      )
                    : undefined
                }
                onConfigure={
                  isA2UIActionAvailable?.(component.configureAction) === false
                    ? undefined
                    : onA2UIAction
                }
                onComplete={
                  component.completionAction &&
                  isA2UIActionAvailable?.(component.completionAction) !== false
                    ? onA2UIAction
                    : undefined
                }
                onNavigate={onA2UIAction}
              />
            </YStack>
          );
      }
    },
    [
      a2uiSourcePostId,
      areA2UISelectionsPending,
      canSendA2UIResponse,
      components,
      consumedA2UIMessageText,
      getConfiguredAgentProviderIds,
      getConsumedA2UISelection,
      handleButtonPress,
      handleChoicePress,
      handleSmallChoiceSubmit,
      isA2UIActionAvailable,
      isA2UIActionConsumed,
      locallyConsumedComponentIds,
      locallyConsumedChoices,
      pendingButtonIds,
      onA2UIAction,
      provisionedAgentTopics,
      surfaceId,
    ]
  );

  if (!root) {
    return null;
  }

  const failedAutoProvision = failedAutoProvisionSurfaceIds.includes(surfaceId)
    ? components.get(AGENT_TASK_PLAN_AUTO_PROVISION_COMPONENT_ID)
    : undefined;

  return (
    <YStack gap="$s" maxWidth={560} {...props}>
      {renderComponent(root)}
      {failedAutoProvision?.component === 'Button' ? (
        <YStack gap="$s" marginTop="$m">
          <Text size="$body" color="$secondaryText">
            Setup couldn’t start. You can try again.
          </Text>
          <Button.Frame
            size="medium"
            fill="outline"
            intent="secondary"
            alignSelf="flex-start"
            accessibilityRole="button"
            accessibilityLabel="Retry setup"
            testID="A2UIAutoProvisionRetry"
            disabled={pendingButtonIds.includes(failedAutoProvision.id)}
            onPress={() => {
              if (
                !claimAutomaticProvisionRetry(
                  autoProvisionRetryLocksRef.current,
                  surfaceId
                )
              ) {
                return;
              }
              autoProvisionAttemptsRef.current.delete(surfaceId);
              setFailedAutoProvisionSurfaceIds((previous) =>
                previous.filter((id) => id !== surfaceId)
              );
              autoProvisionAttemptsRef.current.add(surfaceId);
              void handleButtonPress(failedAutoProvision)
                .then((succeeded) => {
                  if (!succeeded) {
                    setFailedAutoProvisionSurfaceIds((previous) =>
                      previous.includes(surfaceId)
                        ? previous
                        : [...previous, surfaceId]
                    );
                  }
                })
                .finally(() => {
                  autoProvisionRetryLocksRef.current.delete(surfaceId);
                });
            }}
          >
            <Button.Text size="medium">Retry setup</Button.Text>
          </Button.Frame>
        </YStack>
      ) : null}
    </YStack>
  );
}
