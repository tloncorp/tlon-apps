import { randomUUID } from 'node:crypto';
import { withCampaignContext } from '../../src/monitor/campaign/templates.js';
import {
  clearTlonSessionRunSurface,
  rememberTlonSessionRunSurface,
  setTlonSessionSurface,
} from '../../src/onboarding-tool-boundary.js';
import {
  type LabConfig,
  ONBOARDING_GROUP_ID,
  OWNER_SHIP,
  type PromptSources,
} from './config.js';
import {
  buildOwnerMessage,
  buildSystemPrompt,
  runtimeContextMessage,
  templatedOwnerMessage,
} from './context.js';
import { fillSystem } from './template.js';
import { type ChatMessage, type CostMeter, chat } from './openrouter.js';
import { type LabTool, executeTool, labTools } from './tools.js';
import type { BotTurn, TaskPlan, TranscriptEvent } from './types.js';

// OpenClaw has no round limit, only a run timeout; this just stops loops.
const MAX_TOOL_ROUNDS = 30;

/** One owner DM session with the bot, driven turn by turn. */
export class BotSession {
  readonly sessionKey = `agent:main:tlon:direct:${OWNER_SHIP}:lab-${randomUUID()}`;
  readonly messages: ChatMessage[] = [];
  onboardingComplete = false;
  plan?: TaskPlan;
  readonly cronJobs: Record<string, unknown>[] = [];
  private readonly tools: LabTool[];
  private readonly written = new Map<string, string>();
  private readonly sessionId = randomUUID();

  constructor(
    private readonly config: LabConfig,
    private readonly sources: PromptSources,
    private readonly timezone: string,
    private readonly meter: CostMeter,
    private readonly now: () => Date = () => new Date()
  ) {
    this.tools = labTools({
      search: Boolean(config.braveKey),
      template: config.template,
    });
  }

  private systemPrompt() {
    const template = this.config.template;
    return template
      ? fillSystem(template.system, template, this.sources, {
          sessionId: this.sessionId,
        })
      : buildSystemPrompt({
          sources: this.sources,
          tools: this.tools,
          botModel: this.config.models.bot,
          timezone: this.timezone,
          now: this.now(),
        });
  }

  /**
   * `replyTo` is a coordinator message the owner is answering. The model never
   * saw it, so the plugin would have to pass it along; the lab does the same.
   */
  /** A new owner message, as the plugin records it for its turn guards. */
  private ownerSpoke(onboardingActive: boolean) {
    setTlonSessionSurface(this.sessionKey, {
      kind: 'direct',
      senderRole: 'owner',
      channelNest: OWNER_SHIP,
      ...(onboardingActive
        ? { requestedOnboardingGroupId: ONBOARDING_GROUP_ID }
        : {}),
      bootstrapComplete: this.onboardingComplete,
      messageId: randomUUID(),
      onboardingDeviceTimezone: this.timezone,
    });
  }

  private ownerMessage(text: string, onboardingActive: boolean): ChatMessage {
    const template = this.config.template;
    return {
      role: 'user',
      content: template
        ? templatedOwnerMessage({
            template,
            text,
            onboardingActive,
            timezone: this.timezone,
            now: this.now(),
          })
        : buildOwnerMessage({
            text,
            onboardingActive,
            timezone: this.timezone,
            now: this.now(),
          }),
    };
  }

  /**
   * `followUp` is a second owner message sent before the bot answered. Like
   * OpenClaw's steering, it joins the running turn after the current tool
   * calls; if the bot finishes first, `followUpPending` says so.
   */
  async turn(
    userText: string,
    replyTo?: string,
    campaignContext?: string,
    followUp?: string
  ): Promise<BotTurn & { followUpPending?: boolean }> {
    const runId = randomUUID();
    const onboardingActive = !this.onboardingComplete;
    this.ownerSpoke(onboardingActive);
    rememberTlonSessionRunSurface(runId, this.sessionKey, {
      senderRole: 'owner',
    });

    const events: TranscriptEvent[] = [];
    const turn: BotTurn = { userText, toolCalls: [], events };
    let typedSurfacePosted = false;
    const context = {
      sessionKey: this.sessionKey,
      runId,
      onboardingComplete: this.onboardingComplete,
      sources: this.sources,
      botModel: this.config.models.bot,
      braveKey: this.config.braveKey,
      onChoice: (choice: { question: string; options: string[] }) => {
        typedSurfacePosted = true;
        events.push({ from: 'bot', kind: 'choice', choice });
      },
      onPlan: (plan: TaskPlan) => {
        typedSurfacePosted = true;
        this.plan = plan;
        events.push({ from: 'bot', kind: 'plan', plan });
      },
      onServiceSetup: (providerId: string) => {
        events.push({ from: 'bot', kind: 'service-setup', providerId });
      },
      cronJobs: this.cronJobs,
      onCronChange: (action: string, job: unknown) => {
        events.push({ from: 'system', kind: 'task-change', action, job });
      },
      template: this.config.template,
      written: this.written,
      onMessage: (text: string) => {
        events.push({ from: 'bot', kind: 'text', text, source: 'model' });
      },
    };

    const text = campaignContext
      ? withCampaignContext(campaignContext, userText)
      : replyTo
        ? `${userText}\n[Replying to your earlier message: "${replyTo}"]`
        : userText;
    const template = this.config.template;
    this.messages.push(this.ownerMessage(text, onboardingActive));
    let pending = followUp;
    // OpenClaw sends a runtime-context message after the current owner
    // message only; earlier turns lose theirs.
    const runtime: ChatMessage[] = template
      ? [
          {
            role: 'user',
            content: runtimeContextMessage(
              template,
              `${OWNER_SHIP}/170.141.184.508.${Date.now()}`
            ),
          },
        ]
      : [];

    try {
      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const reply = await chat({
          key: this.config.openrouterKey,
          model: this.config.models.bot,
          messages: [
            { role: 'system', content: this.systemPrompt() },
            ...this.messages,
            ...runtime,
          ],
          tools: this.tools,
          meter: this.meter,
          ...this.config.botRequest,
          ...(template?.settings.reasoning
            ? { reasoning: template.settings.reasoning }
            : {}),
        });
        const silent =
          !reply.toolCalls.length &&
          (!reply.content?.trim() || reply.content.trim() === 'NO_REPLY');
        // OpenClaw keeps no trace of a silent final reply in the history.
        if (!(template && silent)) {
          this.messages.push({
            role: 'assistant',
            content: reply.content,
            ...(reply.toolCalls.length ? { tool_calls: reply.toolCalls } : {}),
          });
        }
        if (reply.toolCalls.length) {
          for (const call of reply.toolCalls) {
            let args: Record<string, unknown>;
            try {
              args = JSON.parse(call.function.arguments || '{}');
            } catch {
              args = {};
            }
            const record = await executeTool(
              call.id,
              call.function.name,
              args,
              context
            );
            turn.toolCalls.push(record);
            this.messages.push({
              role: 'tool',
              tool_call_id: call.id,
              content: record.result,
            });
          }
          if (pending) {
            // The owner's second message arrives while the bot is working.
            events.push({ from: 'user', kind: 'type', text: pending });
            this.messages.push(this.ownerMessage(pending, onboardingActive));
            this.ownerSpoke(onboardingActive);
            pending = undefined;
          }
          continue;
        }
        const text = reply.content?.trim() ?? '';
        if (!text || text === 'NO_REPLY') {
          if (!events.length) events.push({ from: 'bot', kind: 'silent' });
        } else if (typedSurfacePosted) {
          // The plugin cancels the first final reply after a typed surface.
          events.push({ from: 'bot', kind: 'suppressed', text });
        } else {
          events.push({ from: 'bot', kind: 'text', text, source: 'model' });
        }
        return pending ? { ...turn, followUpPending: true } : turn;
      }
      throw new Error(
        `bot exceeded ${MAX_TOOL_ROUNDS} tool rounds (${turn.toolCalls
          .slice(-6)
          .map((call) => call.name)
          .join(', ')})`
      );
    } finally {
      clearTlonSessionRunSurface(runId);
    }
  }
}
