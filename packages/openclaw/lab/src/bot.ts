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
import { buildOwnerMessage, buildSystemPrompt } from './context.js';
import { type ChatMessage, type CostMeter, chat } from './openrouter.js';
import { type LabTool, executeTool, labTools } from './tools.js';
import type { BotTurn, TaskPlan, TranscriptEvent } from './types.js';

const MAX_TOOL_ROUNDS = 12;

/** One owner DM session with the bot, driven turn by turn. */
export class BotSession {
  readonly sessionKey = `agent:main:tlon:direct:${OWNER_SHIP}:lab-${randomUUID()}`;
  readonly messages: ChatMessage[] = [];
  onboardingComplete = false;
  plan?: TaskPlan;
  readonly cronJobs: Record<string, unknown>[] = [];
  private readonly tools: LabTool[];

  constructor(
    private readonly config: LabConfig,
    private readonly sources: PromptSources,
    private readonly timezone: string,
    private readonly meter: CostMeter,
    private readonly now: () => Date = () => new Date()
  ) {
    this.tools = labTools({ search: Boolean(config.braveKey) });
  }

  /**
   * `replyTo` is a coordinator message the owner is answering. The model never
   * saw it, so the plugin would have to pass it along; the lab does the same.
   */
  async turn(
    userText: string,
    replyTo?: string,
    campaignContext?: string
  ): Promise<BotTurn> {
    const runId = randomUUID();
    const onboardingActive = !this.onboardingComplete;
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
    };

    this.messages.push({
      role: 'user',
      content: buildOwnerMessage({
        text: campaignContext
          ? withCampaignContext(campaignContext, userText)
          : replyTo
            ? `${userText}\n[Replying to your earlier message: "${replyTo}"]`
            : userText,
        onboardingActive,
        timezone: this.timezone,
        now: this.now(),
      }),
    });

    try {
      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const reply = await chat({
          key: this.config.openrouterKey,
          model: this.config.models.bot,
          messages: [
            {
              role: 'system',
              content: buildSystemPrompt({
                sources: this.sources,
                tools: this.tools,
                botModel: this.config.models.bot,
                timezone: this.timezone,
                now: this.now(),
              }),
            },
            ...this.messages,
          ],
          tools: this.tools,
          meter: this.meter,
          ...this.config.botRequest,
        });
        this.messages.push({
          role: 'assistant',
          content: reply.content,
          ...(reply.toolCalls.length ? { tool_calls: reply.toolCalls } : {}),
        });
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
        return turn;
      }
      throw new Error(`bot exceeded ${MAX_TOOL_ROUNDS} tool rounds`);
    } finally {
      clearTlonSessionRunSurface(runId);
    }
  }
}
