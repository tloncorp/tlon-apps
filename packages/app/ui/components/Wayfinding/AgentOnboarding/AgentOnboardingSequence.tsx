import * as api from '@tloncorp/api';
import { createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import {
  AgentGroupTemplate,
  agentGroupTemplates,
  deriveAgentGroupTitle,
  shortenAgentSubject,
} from '@tloncorp/shared/domain';
import * as store from '@tloncorp/shared/store';
import {
  Icon,
  IconType,
  KeyboardAvoidingView,
  LoadingSpinner,
  Pressable,
  Text,
} from '@tloncorp/ui';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, XStack, YStack } from 'tamagui';

import { TextInput, TextInputRef } from '../../Form';
import {
  AgentAvatar,
  BuildLine,
  BuildReceipt,
  PurposeCard,
  lowerFirst,
} from './shared';

const logger = createDevLogger('AgentOnboarding', false);

const DEFAULT_AGENT_NAME = 'Tlonbot';
const MESSAGE_REVEAL_DELAY_MS = 600;
const BUILD_LINE_REVEAL_DELAY_MS = 450;
const LANDING_DELAY_MS = 2400;
const CUSTOM_PURPOSE_TEMPLATE_ID = 'agent-daily-digest';

type Stage = 'hello' | 'purpose' | 'subject' | 'building' | 'done';

interface ScriptMessage {
  id: string;
  sender: 'agent' | 'user';
  text: string;
  /** quieter second paragraph */
  detail?: string;
  timeLabel: string;
}

function timeLabel() {
  try {
    return new Date().toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

/**
 * Conversational onboarding entry point. Preferred path: the conversation
 * happens for real, inside the hosted home group's chat channel — the live
 * agent conducts the onboarding there (its bootstrap prompt owns the
 * script), so this component just lands the user in that channel. When no
 * home group exists locally (self-hosted, or provisioning hasn't delivered
 * it yet), it falls back to the scripted chat surface, which builds a
 * fresh group instead.
 */
export function AgentOnboardingSequence(props: {
  onCompleted: () => void;
  agentName?: string;
}) {
  const [homeGroupMissing, setHomeGroupMissing] = useState(false);
  const redirectedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const target = await store.getHomeGroupOnboardingTarget();
      if (cancelled || redirectedRef.current) {
        return;
      }
      if (!target) {
        setHomeGroupMissing(true);
        return;
      }
      redirectedRef.current = true;
      logger.trackEvent('Agent Onboarding In-Channel Handoff', target);
      try {
        await db.agentOnboardingLanding.setValue(target);
      } catch (error) {
        logger.trackError('Failed to arm in-channel onboarding', { error });
      }
      props.onCompleted();
      store.completeWayfindingSplash().catch((error) => {
        logger.trackError('Failed to complete wayfinding splash', { error });
      });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!homeGroupMissing) {
    return (
      <View flex={1} alignItems="center" justifyContent="center">
        <LoadingSpinner color="$secondaryText" />
      </View>
    );
  }

  return <ScriptedAgentOnboarding {...props} />;
}

/**
 * The scripted fallback surface: a client-rendered chat with staggered agent
 * messages that ends with a real group built around the user's answer
 * (screens 1–5 of the design), landing via the `agentOnboardingLanding`
 * handoff consumed on chat list mount.
 */
function ScriptedAgentOnboarding(props: {
  onCompleted: () => void;
  agentName?: string;
}) {
  const agentName = props.agentName ?? DEFAULT_AGENT_NAME;
  const insets = useSafeAreaInsets();

  const [stage, setStage] = useState<Stage>('hello');
  const [messages, setMessages] = useState<ScriptMessage[]>([]);
  const [queueEmpty, setQueueEmpty] = useState(false);
  const [buildLines, setBuildLines] = useState<BuildLine[]>([]);
  const [buildActiveLabel, setBuildActiveLabel] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [template, setTemplate] = useState<AgentGroupTemplate | null>(null);
  const customPurposeRef = useRef<string | null>(null);

  const messageQueueRef = useRef<ScriptMessage[]>([]);
  const buildLineQueueRef = useRef<BuildLine[]>([]);
  const messageIdRef = useRef(0);
  const completedRef = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInputRef>(null);

  const [revealTick, setRevealTick] = useState(0);
  const bumpReveal = useCallback(() => setRevealTick((t) => t + 1), []);

  const enqueueAgentMessages = useCallback(
    (items: { text: string; detail?: string; id?: string }[]) => {
      for (const item of items) {
        messageQueueRef.current.push({
          id: item.id ?? `agent-${messageIdRef.current++}`,
          sender: 'agent',
          text: item.text,
          detail: item.detail,
          timeLabel: timeLabel(),
        });
      }
      setQueueEmpty(false);
      bumpReveal();
    },
    [bumpReveal]
  );

  const appendUserMessage = useCallback((text: string) => {
    setMessages((current) => [
      ...current,
      {
        id: `user-${messageIdRef.current++}`,
        sender: 'user',
        text,
        timeLabel: timeLabel(),
      },
    ]);
  }, []);

  const enqueueBuildLines = useCallback(
    (lines: Omit<BuildLine, 'id'>[]) => {
      for (const line of lines) {
        buildLineQueueRef.current.push({
          ...line,
          id: `line-${messageIdRef.current++}`,
        });
      }
      bumpReveal();
    },
    [bumpReveal]
  );

  // Message reveal ticker: agent messages surface one at a time so the
  // opening reads as a conversation, not a wall of copy.
  useEffect(() => {
    if (messageQueueRef.current.length === 0) {
      setQueueEmpty(true);
      return;
    }
    const timer = setTimeout(() => {
      const next = messageQueueRef.current.shift();
      if (next) {
        setMessages((current) => [...current, next]);
      }
      bumpReveal();
    }, MESSAGE_REVEAL_DELAY_MS);
    return () => clearTimeout(timer);
  }, [revealTick, bumpReveal]);

  // Build-line ticker, same idea at a quicker cadence — each line of the
  // receipt ticks in even when the underlying work completed in one burst.
  useEffect(() => {
    if (buildLineQueueRef.current.length === 0) {
      return;
    }
    const timer = setTimeout(() => {
      const next = buildLineQueueRef.current.shift();
      if (next) {
        setBuildLines((current) => [...current, next]);
      }
      bumpReveal();
    }, BUILD_LINE_REVEAL_DELAY_MS);
    return () => clearTimeout(timer);
  }, [revealTick, bumpReveal]);

  useEffect(() => {
    logger.trackEvent('Agent Onboarding Stage', { stage });
  }, [stage]);

  // Opening script.
  useEffect(() => {
    enqueueAgentMessages([
      {
        text: `Hi — I'm ${agentName}. I run on your node, and I work for you.`,
      },
      {
        text: "Today I can watch topics, track things you log, and dig into questions. I don't know you yet — I'll learn as we go, and I'll ask instead of guessing.",
      },
      {
        text: "Let's make you a group that does something useful. What should it do?",
      },
    ]);
    setStage('purpose');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const userInitial = useMemo(() => {
    try {
      const userId = api.getCurrentUserId();
      const letter = userId.replace(/[^a-zA-Z]/g, '').charAt(0);
      return letter ? letter.toUpperCase() : 'Y';
    } catch {
      return 'Y';
    }
  }, []);

  const askSubjectQuestion = useCallback(
    (picked: AgentGroupTemplate) => {
      setTemplate(picked);
      setStage('subject');
      enqueueAgentMessages([
        {
          text: picked.agent.subjectPrompt,
          detail: picked.agent.subjectPromptDetail,
        },
      ]);
    },
    [enqueueAgentMessages]
  );

  const handlePickTemplate = useCallback(
    (picked: AgentGroupTemplate) => {
      logger.trackEvent('Agent Onboarding Template Picked', {
        templateId: picked.id,
      });
      appendUserMessage(picked.agent.cardTitle);
      askSubjectQuestion(picked);
    },
    [appendUserMessage, askSubjectQuestion]
  );

  const finishAndLand = useCallback(
    async (groupId: string, channelId: string) => {
      if (completedRef.current) {
        return;
      }
      completedRef.current = true;
      try {
        await db.agentOnboardingLanding.setValue({ groupId, channelId });
      } catch (error) {
        logger.trackError('Failed to set onboarding landing handoff', {
          error,
        });
      }
      props.onCompleted();
      store.completeWayfindingSplash().catch((error) => {
        logger.trackError('Failed to complete wayfinding splash', { error });
      });
    },
    [props]
  );

  const [landing, setLanding] = useState<{
    groupId: string;
    channelId: string;
  } | null>(null);

  const runBuild = useCallback(
    async (picked: AgentGroupTemplate, subject: string) => {
      const agent = picked.agent;
      setStage('building');
      // A free-form purpose typed instead of picking a card rides along with
      // the subject, so prompts carry it. Everything user-visible derives from
      // this same string as the group the store actually creates.
      const fullSubject = customPurposeRef.current
        ? `${subject} (${customPurposeRef.current})`
        : subject;
      const shortSubject = shortenAgentSubject(fullSubject);
      const title = deriveAgentGroupTitle(fullSubject, picked);
      enqueueAgentMessages([
        {
          text: `${shortSubject} — good subject. Give me a few seconds. You can watch.`,
        },
      ]);
      setBuildActiveLabel('Naming your group…');

      const handleStep: Parameters<
        typeof store.createAgentGroup
      >[0]['onStep'] = (step, status) => {
        if (step === 'create-group' && status === 'done') {
          enqueueBuildLines([
            { text: 'Named your group ', emphasis: title, tone: 'done' },
            ...picked.channels.map((channel) => {
              if (channel.type === 'chat') {
                return {
                  text: 'Added a chat',
                  aside: lowerFirst(channel.description),
                  tone: 'done' as const,
                };
              }
              return {
                text: `Added a ${channel.type}, `,
                emphasis: channel.title,
                aside: lowerFirst(channel.description),
                tone: 'done' as const,
              };
            }),
          ]);
          setBuildActiveLabel('Scheduling the job…');
          return;
        }
        if (step === 'write-config') {
          if (status === 'done') {
            enqueueBuildLines([
              {
                text:
                  agent.jobs.length === 1
                    ? 'Scheduled the job'
                    : `Scheduled ${agent.jobs.length} jobs`,
                aside: agent.jobs[0]?.humanSchedule,
                tone: 'done',
              },
            ]);
          } else {
            enqueueBuildLines([
              {
                text: "Couldn't save the schedule — I'll retry from the group's settings",
                tone: 'muted',
              },
            ]);
          }
          setBuildActiveLabel(
            `Running it once now, so you don't walk into an empty room…`
          );
          return;
        }
        if (step === 'invite-agent') {
          if (status === 'done') {
            enqueueBuildLines([
              {
                text: `Asked ${agentName} for a first run`,
                aside: "it's on the way",
                tone: 'done',
              },
            ]);
          } else {
            enqueueBuildLines([
              {
                text: `${agentName} isn't reachable yet`,
                aside: "it'll pick this up when it comes online",
                tone: 'muted',
              },
            ]);
          }
          setBuildActiveLabel(null);
        }
      };

      try {
        const result = await store.createAgentGroup({
          templateId: picked.id,
          subject: fullSubject,
          onStep: handleStep,
        });

        setStage('done');
        enqueueAgentMessages([
          {
            id: 'confirm',
            text: agent.confirmationTemplate.replaceAll(
              '{subject}',
              shortSubject
            ),
          },
        ]);
        setLanding({
          groupId: result.group.id,
          channelId: result.chatChannelId,
        });
      } catch (error) {
        logger.trackError('Agent onboarding build failed', { error });
        setBuildActiveLabel(null);
        setBuildLines([]);
        buildLineQueueRef.current = [];
        setStage('subject');
        enqueueAgentMessages([
          {
            text: "Hmm — something went sideways while I was building. Let's try that again: what should I keep up with for you?",
          },
        ]);
      }
    },
    [agentName, enqueueAgentMessages, enqueueBuildLines]
  );

  // Land inside the built group once the closing message has been read.
  useEffect(() => {
    if (!landing || !messages.some((message) => message.id === 'confirm')) {
      return;
    }
    const timer = setTimeout(() => {
      finishAndLand(landing.groupId, landing.channelId);
    }, LANDING_DELAY_MS);
    return () => clearTimeout(timer);
  }, [landing, messages, finishAndLand]);

  const handleSend = useCallback(() => {
    const text = inputValue.trim();
    if (!text) {
      return;
    }
    setInputValue('');
    if (stage === 'building' || stage === 'done') {
      return;
    }
    appendUserMessage(text);
    if (stage === 'hello' || stage === 'purpose') {
      // A typed reply is a free-form purpose: fold it into the default
      // template and move straight to the subject question.
      customPurposeRef.current = text;
      const fallback =
        agentGroupTemplates.find((t) => t.id === CUSTOM_PURPOSE_TEMPLATE_ID) ??
        agentGroupTemplates[0];
      askSubjectQuestion(fallback);
      return;
    }
    if (stage === 'subject' && template) {
      runBuild(template, text);
    }
  }, [
    appendUserMessage,
    askSubjectQuestion,
    inputValue,
    runBuild,
    stage,
    template,
  ]);

  const showPurposeCards = stage === 'purpose' && queueEmpty;
  const showAdvancedSetup = stage === 'subject' && queueEmpty;
  const composerEnabled = stage !== 'building' && stage !== 'done';

  useEffect(() => {
    if (showAdvancedSetup) {
      inputRef.current?.focus();
    }
  }, [showAdvancedSetup]);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }}>
      <View flex={1} backgroundColor="$background" paddingTop={insets.top}>
        <XStack
          height={48}
          alignItems="center"
          justifyContent="center"
          gap="$m"
          borderBottomWidth={1}
          borderBottomColor="$border"
        >
          <AgentAvatar size={24} />
          <Text size="$label/xl" trimmed={false}>
            {agentName}
          </Text>
        </XStack>

        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'flex-end',
            paddingVertical: 12,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() =>
            scrollRef.current?.scrollToEnd({ animated: true })
          }
        >
          {messages.map((message) => (
            <MessageRow
              key={message.id}
              message={message}
              agentName={agentName}
              userInitial={userInitial}
            />
          ))}

          {showPurposeCards ? (
            <YStack
              gap="$m"
              paddingHorizontal="$xl"
              paddingLeft={54}
              paddingTop="$m"
            >
              {agentGroupTemplates.map((candidate) => (
                <PurposeCard
                  key={candidate.id}
                  template={candidate}
                  onPress={() => handlePickTemplate(candidate)}
                />
              ))}
              <Text
                size="$label/m"
                color="$tertiaryText"
                trimmed={false}
                paddingTop="$s"
              >
                Or describe something else — the cards are just starts.
              </Text>
            </YStack>
          ) : null}

          {showAdvancedSetup ? (
            <YStack
              paddingLeft={54}
              paddingRight="$xl"
              paddingTop="$m"
              gap="$s"
            >
              <Pressable onPress={() => setAdvancedOpen((open) => !open)}>
                <XStack alignItems="center" gap="$xs">
                  <Text size="$label/m" color="$tertiaryText" trimmed={false}>
                    Advanced setup
                  </Text>
                  <Icon
                    type={advancedOpen ? 'ChevronUp' : 'ChevronDown'}
                    color="$tertiaryText"
                    customSize={[14, 14]}
                  />
                </XStack>
              </Pressable>
              {advancedOpen ? (
                <Text size="$label/m" color="$tertiaryText" trimmed={false}>
                  I'll start on your node's built-in model. You can switch
                  providers, add API keys, or rename me anytime in Settings.
                </Text>
              ) : null}
            </YStack>
          ) : null}

          {stage === 'building' || stage === 'done' ? (
            <BuildReceipt lines={buildLines} activeLabel={buildActiveLabel} />
          ) : null}
        </ScrollView>

        <XStack
          alignItems="center"
          gap="$m"
          paddingHorizontal="$l"
          paddingVertical="$m"
          borderTopWidth={1}
          borderTopColor="$border"
          paddingBottom={Math.max(insets.bottom, 12)}
        >
          <TextInput
            ref={inputRef}
            testID="AgentOnboardingInput"
            value={inputValue}
            onChangeText={setInputValue}
            placeholder="Message"
            editable={composerEnabled}
            onSubmitEditing={handleSend}
            returnKeyType="send"
            frameStyle={{ flex: 1, borderRadius: 20, height: 44 }}
          />
          <Pressable
            testID="AgentOnboardingSend"
            accessibilityLabel="Send"
            onPress={handleSend}
            disabled={!composerEnabled || !inputValue.trim()}
          >
            <View
              width={36}
              height={36}
              borderRadius={18}
              alignItems="center"
              justifyContent="center"
              backgroundColor={
                composerEnabled && inputValue.trim()
                  ? '$positiveActionText'
                  : '$secondaryBackground'
              }
            >
              <Icon
                type="ArrowUp"
                color={
                  composerEnabled && inputValue.trim()
                    ? '$white'
                    : '$tertiaryText'
                }
                customSize={[18, 18]}
              />
            </View>
          </Pressable>
        </XStack>
      </View>
    </KeyboardAvoidingView>
  );
}

function MessageRow({
  message,
  agentName,
  userInitial,
}: {
  message: ScriptMessage;
  agentName: string;
  userInitial: string;
}) {
  const isAgent = message.sender === 'agent';
  return (
    <XStack gap="$m" paddingHorizontal="$xl" paddingVertical="$s">
      {isAgent ? (
        <AgentAvatar size={28} />
      ) : (
        <View
          width={28}
          height={28}
          borderRadius={7}
          backgroundColor="$indigo"
          alignItems="center"
          justifyContent="center"
        >
          <Text fontSize={12} fontWeight="500" color="$white" trimmed={false}>
            {userInitial}
          </Text>
        </View>
      )}
      <YStack flex={1} minWidth={0}>
        <XStack alignItems="baseline" gap="$m">
          <Text size="$label/m" fontWeight="600" trimmed={false}>
            {isAgent ? agentName : 'You'}
          </Text>
          <Text size="$label/s" color="$tertiaryText" trimmed={false}>
            {message.timeLabel}
          </Text>
        </XStack>
        <Text size="$body" trimmed={false} paddingTop="$xs">
          {message.text}
        </Text>
        {message.detail ? (
          <Text
            size="$body"
            color="$secondaryText"
            trimmed={false}
            paddingTop="$m"
          >
            {message.detail}
          </Text>
        ) : null}
      </YStack>
    </XStack>
  );
}
